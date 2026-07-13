const authMap = new Map();

authMap.set("/user/current", { role: "user" });
authMap.set("/user/forgetpwd", { role: "user" });
authMap.set("/user/profile", { role: "user" });
authMap.set("/user/password", { role: "user" });
authMap.set("/user/follow/status/:id", { role: "user" });
authMap.set("/user/follow/:id", { role: "user" });
authMap.set("/user/followers", { role: "user" });
authMap.set("/user/following", { role: "user" });
authMap.set("/user/dm/unread/summary", { role: "user" });
authMap.set("/user/dm/:targetUserId", { role: "user" });
authMap.set("/upload/image", { role: "user" });

authMap.set("/article/page_admin", { role: "user" });
authMap.set("/article/user/page", { role: "user" });
authMap.set("/article/add", { role: "user" });
authMap.set("/article/delete", { role: "user" });
authMap.set("/article/publish", { role: "user" });
authMap.set("/article/update", { role: "user" });
authMap.set("/article/update_private", { role: "user" });
authMap.set("/article/update_deleted", { role: "user" });

authMap.set("/comment/get_not_approved", { role: "user" });
authMap.set("/comment/page_not_approved", { role: "user" });
authMap.set("/comment/review", { role: "user" });
authMap.set("/comment/page_admin", { role: "user" });
authMap.set("/comment/update", { role: "user" });
authMap.set("/comment/delete", { role: "user" });

authMap.set("/reply/getReplyOfCommentWaitReview", { role: "user" });
authMap.set("/reply/getReplyOfMsgWaitReview", { role: "user" });
authMap.set("/reply/unreviewd_reply_page", { role: "user" });
authMap.set("/reply/review", { role: "user" });
authMap.set("/reply/add", { role: "user" });

authMap.set("/comment/total", { role: "user" });
authMap.set("/comment/number_of_people", { role: "user" });

// 分类总览用于前台公开浏览，不应要求登录。
authMap.set("/category/my", { role: "user" });
authMap.set("/category/admin/page", { role: "user" });
authMap.set("/category/admin/update", { role: "user" });

// 标签总览用于前台公开浏览，不应要求登录。
authMap.set("/tag/my", { role: "user" });
authMap.set("/tag/admin/page", { role: "user" });

authMap.set("/agent/start", { role: "user" });
authMap.set("/agent/stream-start", { role: "user" });
authMap.set("/agent/state/:sessionId", { role: "user" });
authMap.set("/agent/confirm-outline", { role: "user" });
authMap.set("/agent/next-section", { role: "user" });
authMap.set("/agent/revise-section", { role: "user" });
authMap.set("/agent/skip-section", { role: "user" });
authMap.set("/agent/complete", { role: "user" });
authMap.set("/agent/stream-complete", { role: "user" });
authMap.set("/agent/feedback", { role: "user" });
authMap.set("/agent/reset", { role: "user" });
authMap.set("/agent/stream-section/:sessionId/:sectionIndex", { role: "user" });

module.exports = authMap;
