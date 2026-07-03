const express = require("express");
const router = express.Router();
const indexSQL = require("../sql");
const dbUtils = require("../utils/db");
const omit = require("lodash/omit");

/**
 * @param {Number} getCount 是否返回分类下的文章数量
 * @description 查询分类
 */
router.get("/all", function(req, res, next) {
    const sql = req.query.getCount ? indexSQL.QueryCategoryAndCount : indexSQL.QueryAllCategories;
    dbUtils.query(sql).then(({ results }) => {
        if (results) {
            res.send({
                code: "0",
                data: results,
            });
        } else {
            res.send({
                code: "007001",
                data: [],
            });
        }
    });
});

/**
 * @param {Number} getCount 是否返回分类下的文章数量
 * @description 查询当前用户的分类
 */
router.get("/my", function(req, res, next) {
    if (!req.currentUser) {
        res.send({
            code: "007001",
            data: [],
        });
        return;
    }

    const userId = req.currentUser.id;
    const sql = req.query.getCount ? indexSQL.QueryCategoryAndCountByUserID : indexSQL.QueryCategoriesByUserID;
    dbUtils.query({ sql, values: [userId] }).then(({ results }) => {
        if (results) {
            res.send({
                code: "0",
                data: results,
            });
        } else {
            res.send({
                code: "007001",
                data: [],
            });
        }
    });
});

/**
 * @description 获取分类总数
 */
router.get("/count", function(req, res, next) {
    dbUtils.query(indexSQL.GetCategoryCount).then(({ results }) => {
        if (results) {
            res.send({
                code: "0",
                data: results[0].count,
            });
        } else {
            res.send({
                code: "007002",
                data: [],
            });
        }
    });
});

/**
 * @description 管理员分页获取分类
 */
router.get("/admin/page", function(req, res, next) {
    const params = req.query;
    const pageNo = Number(params.pageNo || 1);
    const pageSize = Number(params.pageSize || 10);
    const sqlParams = [(pageNo - 1) * pageSize, pageSize];

    dbUtils.query({ sql: indexSQL.GetCategoryAdminPage, values: sqlParams }).then(({ results }) => {
        if (results) {
            const list = results[0].map((item) => ({
                ...omit(item, "article_ids"),
                category_count: item.article_ids ? item.article_ids.split(",").length : 0,
            }));

            res.send({
                code: "0",
                data: list,
                total: results[1][0].total,
            });
        } else {
            res.send({
                code: "0007003",
                data: [],
            });
        }
    });
});

/**
 * @description 管理员更新分类
 */
router.put("/admin/update", function(req, res, next) {
    const { id } = req.body;

    try {
        dbUtils.query({ sql: indexSQL.AdminUpdateCategory, values: [req.body, id] })
            .then(({ results }) => {
                if (results) {
                    res.send({
                        code: "0",
                        data: null,
                    });
                } else {
                    res.send({
                        code: "007004",
                        data: 0,
                    });
                }
            })
            .catch((error) => {
                console.error("Admin update category error:", error);
                res.send({
                    code: "007005",
                    data: 0,
                });
            });
    } catch (error) {
        console.error("Admin update category catch error:", error);
        res.send({
            code: "007006",
            data: 0,
        });
    }
});

module.exports = router;
