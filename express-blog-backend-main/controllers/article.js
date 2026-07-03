const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const indexSQL = require("../sql");
const config = require("../config");
const dbUtils = require("../utils/db");
const errcode = require("../utils/errcode");

const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 10;

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getPageParams = (query) => ({
    pageNo: Math.max(toNumber(query.pageNo, DEFAULT_PAGE_NO), 1),
    pageSize: Math.max(toNumber(query.pageSize, DEFAULT_PAGE_SIZE), 1),
});

const normalizeKeyword = (value) => String(value || "").trim();
const toLikeKeyword = (keyword) => `%${keyword}%`;

const normalizeStringList = (input) => {
    if (!Array.isArray(input)) {
        return [];
    }

    return [...new Set(input.map((item) => String(item || "").trim()).filter(Boolean))];
};

const normalizeNumberList = (input) => {
    if (!Array.isArray(input)) {
        return [];
    }

    return [...new Set(input.map((item) => toNumber(item)).filter((item) => item > 0))];
};

const formatArticleRelations = (item) => {
    if (!item || typeof item !== "object") {
        return item;
    }

    if (item.categoryIDs && item.categoryNames) {
        const categoryIds = String(item.categoryIDs)
            .split(" ")
            .map((id) => Number(id))
            .filter(Boolean);
        const categoryNames = String(item.categoryNames).split(" ");
        item.categories = categoryIds.map((id, index) => ({
            id,
            categoryName: categoryNames[index],
        }));
    } else {
        item.categories = [];
    }

    if (item.tagIDs && item.tagNames) {
        const tagIds = String(item.tagIDs)
            .split(" ")
            .map((id) => Number(id))
            .filter(Boolean);
        const tagNames = String(item.tagNames).split(" ");
        item.tags = tagIds.map((id, index) => ({
            id,
            tagName: tagNames[index],
        }));
    } else {
        item.tags = [];
    }

    delete item.categoryIDs;
    delete item.categoryNames;
    delete item.tagIDs;
    delete item.tagNames;

    return item;
};

const formatArticleList = (list) => {
    if (!Array.isArray(list)) {
        return [];
    }

    return list.map((item) => formatArticleRelations(item));
};

const sendPage = (res, results) => {
    const rows = Array.isArray(results?.[0]) ? results[0] : [];
    const total = Number(results?.[1]?.[0]?.total || 0);

    res.send({
        code: "0",
        data: formatArticleList(rows),
        total,
    });
};

const sendCode = (res, code, extra = {}) => {
    res.send({
        code,
        ...extra,
    });
};

const sendServerError = (res, error, fallbackCode = "500000", fallbackMsg = "server error") => {
    console.error(error);
    res.send({
        code: fallbackCode,
        msg: fallbackMsg,
        data: Array.isArray(error) ? [] : null,
        total: 0,
    });
};

const getTokenFromRequest = (req) => {
    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
        return authorization.replace("Bearer ", "");
    }

    return "";
};

const getCurrentUserFromRequest = (req) => {
    if (req.currentUser) {
        return req.currentUser;
    }

    const token = getTokenFromRequest(req);
    if (!token) {
        return null;
    }

    try {
        return jwt.verify(token, config.jwt.secret);
    } catch (_error) {
        return null;
    }
};

const isAdminUser = (user) => user?.role_name === "admin" || user?.roleName === "admin";
const getUserId = (user) => toNumber(user?.id || user?.userId, 0);

const assertArticleOwner = async (articleId, currentUser) => {
    if (!currentUser) {
        return false;
    }

    if (isAdminUser(currentUser)) {
        return true;
    }

    const authorId = getUserId(currentUser);
    if (!authorId) {
        return false;
    }

    const { results } = await dbUtils.query({
        sql: indexSQL.GetArticleByIdAndAuthorId,
        values: [articleId, authorId],
    });

    return Array.isArray(results) && results.length > 0;
};

const resolveTagId = async (connection, tagName) => {
    const { results } = await dbUtils.query({ sql: indexSQL.CheckTag, values: [tagName] }, connection, false);
    if (Array.isArray(results) && results.length > 0) {
        return Number(results[0].id);
    }

    await dbUtils.query({ sql: indexSQL.AddTags, values: [tagName] }, connection, false);
    const inserted = await dbUtils.query({ sql: indexSQL.CheckTag, values: [tagName] }, connection, false);
    return Number(inserted.results?.[0]?.id || 0);
};

const resolveCategoryId = async (connection, categoryName) => {
    const { results } = await dbUtils.query({ sql: indexSQL.CheckCategory, values: [categoryName] }, connection, false);
    if (Array.isArray(results) && results.length > 0) {
        return Number(results[0].id);
    }

    await dbUtils.query({ sql: indexSQL.AddCategories, values: [categoryName] }, connection, false);
    const inserted = await dbUtils.query({ sql: indexSQL.CheckCategory, values: [categoryName] }, connection, false);
    return Number(inserted.results?.[0]?.id || 0);
};

const withTransaction = async (handler) => {
    const connection = await dbUtils.getConnection();

    try {
        await new Promise((resolve, reject) => {
            connection.beginTransaction((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });

        const result = await handler(connection);

        await new Promise((resolve, reject) => {
            connection.commit((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });

        return result;
    } catch (error) {
        await new Promise((resolve) => {
            connection.rollback(() => resolve());
        });
        throw error;
    } finally {
        connection.release();
    }
};

router.get("/top_read", async (req, res) => {
    try {
        const count = Math.max(toNumber(req.query.count, 5), 1);
        const { results } = await dbUtils.query({ sql: indexSQL.GetTopRead, values: [count] });

        res.send({
            code: "0",
            data: results || [],
        });
    } catch (error) {
        sendServerError(res, error, "003010", "failed to load top articles");
    }
});

router.get("/page", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const { results } = await dbUtils.query({
            sql: indexSQL.GetPagedArticle,
            values: [(pageNo - 1) * pageSize, pageSize],
        });

        sendPage(res, results);
    } catch (error) {
        sendServerError(res, error, "003001", "failed to load articles");
    }
});

router.get("/page_admin", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const { results } = await dbUtils.query({
            sql: indexSQL.GetArticlePageAdmin,
            values: [(pageNo - 1) * pageSize, pageSize],
        });

        sendPage(res, results);
    } catch (error) {
        sendServerError(res, error, "013001", "failed to load admin article list");
    }
});

router.get("/user/page", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const keyword = normalizeKeyword(req.query.keyword);
        const authorId = getUserId(req.currentUser);

        const queryOptions = keyword
            ? {
                  sql: indexSQL.GetUserArticlePageWithKeyword,
                  values: [authorId, toLikeKeyword(keyword), toLikeKeyword(keyword), toLikeKeyword(keyword), (pageNo - 1) * pageSize, pageSize],
              }
            : {
                  sql: indexSQL.GetUserArticlePage,
                  values: [authorId, (pageNo - 1) * pageSize, pageSize],
              };

        const { results } = await dbUtils.query(queryOptions);
        sendPage(res, results);
    } catch (error) {
        sendServerError(res, error, "013001", "failed to load current user articles");
    }
});

router.get("/neighbors", async (req, res) => {
    try {
        const articleId = toNumber(req.query.id, 0);
        const { results } = await dbUtils.query({
            sql: indexSQL.QueryPreAndNextArticleIds,
            values: [articleId, articleId],
        });

        res.send({
            code: "0",
            data: results || [],
        });
    } catch (error) {
        sendServerError(res, error, "004010", "failed to load article neighbors");
    }
});

router.put("/update_read_num", async (req, res) => {
    try {
        await dbUtils.query({
            sql: indexSQL.UpdateReadSum,
            values: [toNumber(req.body.id, 0)],
        });

        sendCode(res, "0");
    } catch (error) {
        sendServerError(res, error, "008001", "failed to update read count");
    }
});

router.put("/update_private", async (req, res) => {
    try {
        const articleId = toNumber(req.body.id, 0);
        const privateState = toNumber(req.body.private, 0);
        const canEdit = await assertArticleOwner(articleId, req.currentUser);

        if (!canEdit) {
            res.send({
                code: "008003",
                msg: "无权操作此文章",
            });
            return;
        }

        await dbUtils.query({
            sql: indexSQL.UpdateArticlePrivate,
            values: [privateState, articleId],
        });

        sendCode(res, "0");
    } catch (error) {
        sendServerError(res, error, "008002", "failed to update private status");
    }
});

router.put("/update_deleted", async (req, res) => {
    try {
        const articleId = toNumber(req.body.id, 0);
        const deletedState = toNumber(req.body.deleted, 0);
        const canEdit = await assertArticleOwner(articleId, req.currentUser);

        if (!canEdit) {
            res.send({
                code: "008003",
                msg: "无权操作此文章",
            });
            return;
        }

        await dbUtils.query({
            sql: indexSQL.UpdateArticleDeleted,
            values: [deletedState, articleId],
        });

        sendCode(res, "0");
    } catch (error) {
        sendServerError(res, error, "008001", "failed to update deleted status");
    }
});

router.delete("/delete", async (req, res) => {
    try {
        const articleId = toNumber(req.query.id, 0);
        const canEdit = await assertArticleOwner(articleId, req.currentUser);

        if (!canEdit) {
            res.send({
                code: "008003",
                msg: "无权操作此文章",
            });
            return;
        }

        await dbUtils.query({
            sql: indexSQL.DeleteArticleById,
            values: [articleId],
        });

        sendCode(res, "0");
    } catch (error) {
        sendServerError(res, error, "008001", "failed to delete article");
    }
});

router.get("/detail", async (req, res) => {
    try {
        const articleId = toNumber(req.query.id, 0);
        const { results } = await dbUtils.query({
            sql: indexSQL.GetArticleByID,
            values: [articleId],
        });

        const article = Array.isArray(results) ? results[0] : null;
        if (!article) {
            res.send({
                code: "004001",
                data: null,
            });
            return;
        }

        const currentUser = getCurrentUserFromRequest(req);
        const isOwner = getUserId(currentUser) > 0 && getUserId(currentUser) === toNumber(article.author_id, 0);

        if (article.private && !isOwner && !isAdminUser(currentUser)) {
            res.send({
                ...errcode.AUTH.FORBIDDEN,
            });
            return;
        }

        res.send({
            code: "0",
            data: formatArticleRelations(article),
        });
    } catch (error) {
        sendServerError(res, error, "004001", "failed to load article detail");
    }
});

router.get("/page_by_category", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const keyword = normalizeKeyword(req.query.keyword);
        const { results } = await dbUtils.query({
            sql: indexSQL.GetPagedArticleByCategory,
            values: [keyword, (pageNo - 1) * pageSize, pageSize],
        });

        sendPage(res, results);
    } catch (error) {
        sendServerError(res, error, "003001", "failed to load category articles");
    }
});

router.get("/page_by_tag", async (req, res) => {
    try {
        const { pageNo, pageSize } = getPageParams(req.query);
        const keyword = normalizeKeyword(req.query.keyword);
        const { results } = await dbUtils.query({
            sql: indexSQL.GetPagedArticleByTag,
            values: [keyword, (pageNo - 1) * pageSize, pageSize],
        });

        sendPage(res, results);
    } catch (error) {
        sendServerError(res, error, "003001", "failed to load tag articles");
    }
});

router.get("/page_by_author", async (req, res) => {
    try {
        const authorId = toNumber(req.query.authorId, 0);
        if (!authorId) {
            res.send({
                code: "003002",
                msg: "authorId is required",
                data: [],
                total: 0,
            });
            return;
        }

        const { pageNo, pageSize } = getPageParams(req.query);
        const keyword = normalizeKeyword(req.query.keyword);
        const queryOptions = keyword
            ? {
                  sql: indexSQL.GetPagedArticleByAuthorWithKeyword,
                  values: [authorId, toLikeKeyword(keyword), toLikeKeyword(keyword), toLikeKeyword(keyword), (pageNo - 1) * pageSize, pageSize],
              }
            : {
                  sql: indexSQL.GetPagedArticleByAuthor,
                  values: [authorId, (pageNo - 1) * pageSize, pageSize],
              };

        const { results } = await dbUtils.query(queryOptions);
        sendPage(res, results);
    } catch (error) {
        sendServerError(res, error, "003001", "failed to load author articles");
    }
});

router.get("/search", async (req, res) => {
    try {
        const keyword = normalizeKeyword(req.query.keyword);
        if (!keyword) {
            res.send({
                code: "0",
                data: [],
                total: 0,
            });
            return;
        }

        const { pageNo, pageSize } = getPageParams(req.query);
        const { results } = await dbUtils.query({
            sql: indexSQL.SearchPagedArticle,
            values: [toLikeKeyword(keyword), toLikeKeyword(keyword), toLikeKeyword(keyword), (pageNo - 1) * pageSize, pageSize],
        });

        sendPage(res, results);
    } catch (error) {
        sendServerError(res, error, "003001", "failed to search articles");
    }
});

router.post("/add", async (req, res) => {
    const params = req.body || {};
    const authorId = getUserId(req.currentUser);

    try {
        await withTransaction(async (connection) => {
            const publishResult = await dbUtils.query(
                {
                    sql: indexSQL.PublishArticle,
                    values: [
                        String(params.articleTitle || "").trim(),
                        String(params.articleText || ""),
                        String(params.summary || "").trim(),
                        authorId,
                        String(params.poster || "").trim(),
                    ],
                },
                connection,
                false
            );

            const articleId = Number(publishResult.results?.insertId || 0);
            const oldCategoryIds = normalizeNumberList(params.oldCategoryIds);
            const newCategoryNames = normalizeStringList(params.newCategories);
            const tagNames = normalizeStringList(params.tags);

            for (const categoryId of oldCategoryIds) {
                await dbUtils.query({ sql: indexSQL.AddArticleCategory, values: [articleId, categoryId] }, connection, false);
            }

            for (const categoryName of newCategoryNames) {
                const categoryId = await resolveCategoryId(connection, categoryName);
                if (categoryId) {
                    await dbUtils.query({ sql: indexSQL.AddArticleCategory, values: [articleId, categoryId] }, connection, false);
                }
            }

            for (const tagName of tagNames) {
                const tagId = await resolveTagId(connection, tagName);
                if (tagId) {
                    await dbUtils.query({ sql: indexSQL.AddArticleTag, values: [articleId, tagId] }, connection, false);
                }
            }
        });

        sendCode(res, "0");
    } catch (error) {
        sendServerError(res, error, "002001", "failed to publish article");
    }
});

router.put("/update", async (req, res) => {
    const params = req.body || {};
    const articleId = toNumber(params.id, 0);

    try {
        const canEdit = await assertArticleOwner(articleId, req.currentUser);
        if (!canEdit) {
            res.send({
                code: "008003",
                msg: "无权操作此文章",
            });
            return;
        }

        await withTransaction(async (connection) => {
            const updatePayload = {
                article_name: String(params.articleTitle || "").trim(),
                content: String(params.articleText || ""),
                poster: String(params.poster || "").trim(),
                summary: String(params.summary || "").trim(),
                private: toNumber(params.private, 0),
                update_time: new Date(),
            };

            await dbUtils.query(
                {
                    sql: indexSQL.UpdateArticle,
                    values: [updatePayload, articleId],
                },
                connection,
                false
            );

            const deleteTagIds = normalizeNumberList(params.deleteTagIDs);
            const deleteCategoryIds = normalizeNumberList(params.deleteCategoryIDs);
            const relatedCategoryIds = normalizeNumberList(params.relatedCategoryIDs);
            const newTagNames = normalizeStringList(params.newTags);
            const newCategoryNames = normalizeStringList(params.newCategories);

            for (const tagId of deleteTagIds) {
                await dbUtils.query({ sql: indexSQL.DeleteArticleTag, values: [articleId, tagId] }, connection, false);
            }

            for (const categoryId of deleteCategoryIds) {
                await dbUtils.query({ sql: indexSQL.DeleteArticleCategory, values: [articleId, categoryId] }, connection, false);
            }

            for (const tagName of newTagNames) {
                const tagId = await resolveTagId(connection, tagName);
                if (tagId) {
                    await dbUtils.query({ sql: indexSQL.AddArticleTag, values: [articleId, tagId] }, connection, false);
                }
            }

            for (const categoryName of newCategoryNames) {
                const categoryId = await resolveCategoryId(connection, categoryName);
                if (categoryId) {
                    await dbUtils.query({ sql: indexSQL.AddArticleCategory, values: [articleId, categoryId] }, connection, false);
                }
            }

            for (const categoryId of relatedCategoryIds) {
                await dbUtils.query({ sql: indexSQL.AddArticleCategory, values: [articleId, categoryId] }, connection, false);
            }
        });

        sendCode(res, "0");
    } catch (error) {
        sendServerError(res, error, "002001", "failed to update article");
    }
});

module.exports = router;
