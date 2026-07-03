const express = require('express');
const router = express.Router();
const config = require('../config');
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: config.chatgpt.key,
});

// DeepSeek API 配置
const deepSeekApiKey = config.aiWriter.deepseekApiKey;
const deepSeekApiUrl = config.aiWriter.deepseekBaseUrl + '/chat/completions';

/**
 * @param {Number} wd 聊天上下文
 * @description chatgpt对话 V1
 */
// router.get('/chat-v1', async function(req, res, next) {
//     // 取得用户输入
//     const wd = req.query.wd;
//     if (!req.session.chatgptSessionPrompt) {
//         req.session.chatgptSessionPrompt = ''
//     }
//     // 构造 prompt 参数
//     const prompt = req.session.chatgptSessionPrompt + `\n提问:` + wd + `\nAI:`
//     try {
//         const completion = await openai.createCompletion({
//             model: "text-davinci-003",
//             prompt,
//             temperature: 0.9,
//             max_tokens: 150,
//             top_p: 1,
//             frequency_penalty: 0,
//             presence_penalty: 0.6,
//             stop: ["\n提问:", "\nAI:"],
//         });
//         // 调用 Open AI 成功后，更新 session
//         req.session.chatgptSessionPrompt = prompt + completion.data
//         // 返回结果
//         res.status(200).json({
//             code: '0',
//             result: completion.data.choices[0].text
//         });
//     } catch (error) {
//         console.error(error)
//         res.status(500).json({
//             message: "Open AI 调用异常"
//         });
//     }
// });

// router.get('/chat-v2', async function(req, res, next) {
//     if (!req.session.chatgptSessionPrompt) {
//         req.session.chatgptSessionPrompt = ''
//     }
//     const wd = req.query.wd;
//     const prompt = req.session.chatgptSessionPrompt + `\n提问:` + wd + `\nAI:`
//     try {
//         const completion = await openai.createCompletion({
//             model: "text-davinci-003",
//             prompt,
//             temperature: 0.9,
//             max_tokens: 150,
//             top_p: 1,
//             frequency_penalty: 0,
//             presence_penalty: 0.6,
//             stop: ["\n提问:", "\nAI:"],
//             stream: true
//         }, { responseType: 'stream' });
//         res.setHeader("content-type", "text/event-stream")
//         completion.data.pipe(res)
//     } catch (error) {
//         console.error(error)
//         res.status(500).json({
//             message: "Open AI 调用异常"
//         });
//     }
// });

router.get('/chat', async function(req, res, next) {
    if (req.session.chatgptTimes && req.session.chatgptTimes >= 50) {
        // 到达调用上限，欢迎明天再来哦，实际上还需要定时任务，这里先不做了。
        return res.status(403).json({
            msg: "到达调用上限，欢迎明天再来哦"
        });
    }
    if (req.session.chatgptTopicCount && req.session.chatgptTopicCount >= 10) {
        // 这个话题聊得有点深入了，不如换一个。
        req.session.chatgptSessionPrompt = ''
        req.session.chatgptTopicCount = 0
        return res.status(403).json({
            msg: "这个话题聊得有点深入了，不如换一个"
        });
    }
    if (req.session.chatgptRequestTime && Date.now() - req.session.chatgptRequestTime <= 3000) {
        // 如果在3s里重复调用，不允许
        return res.status(403).json({
            msg: "请降低请求频次"
        });
    }
    if (!req.session.chatgptSessionPrompt) {
        req.session.chatgptSessionPrompt = ''
    }
    const wd = req.query.wd || '';
    if (wd.length <= 1) {
        return res.status(400).json({
            msg: "你说得太少了，我不明白"
        });
    }
    if (wd.length >= 60) {
        return res.status(400).json({
            msg: "请不要输入太长的内容"
        });
    }
    const prompt = req.session.chatgptSessionPrompt + `\n提问:` + wd + `\nAI:`
    try {
        const completion = await openai.completions.create({
            model: "text-davinci-003",
            prompt,
            temperature: 0.9,
            max_tokens: 150,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0.6,
            stop: ["\n提问:", "\nAI:"],
            stream: true
        }, { responseType: 'stream' });
        req.session.chatgptRequestTime = Date.now()
        if (!req.session.chatgptTopicCount) {
            req.session.chatgptTopicCount = 1
        } else {
            req.session.chatgptTopicCount += 1
        }
        if (!req.session.chatgptTimes) {
            req.session.chatgptTimes = 1
        } else {
            req.session.chatgptTimes += 1
        }
        res.setHeader("content-type", "text/event-stream")
        completion.data.pipe(res)
    } catch (error) {
        console.error(error)
        res.status(500).json({
            message: "Open AI 调用异常"
        });
    }
});

/**
 * @param {Number} wd 聊天上下文
 * @description chatgpt对话
 */
router.get('/chat', async function(req, res, next) {
    if (req.session.chatgptTopicCount && req.session.chatgptTopicCount >= 10) {
        // 这个话题聊得有点深入了，不如换一个。
        req.session.chatgptSessionPrompt = ''
        req.session.chatgptTopicCount = 0
        return res.status(403).json({
            msg: "这个话题聊得有点深入了，不如换一个"
        });
    }
    if (req.session.chatgptTimes && req.session.chatgptTimes >= 50) {
        // 到达调用上限，欢迎明天再来哦，实际上还需要定时任务，这里先不做了。
        return res.status(403).json({
            msg: "到达调用上限，欢迎明天再来哦"
        });
    }
    if (req.session.chatgptRequestTime && Date.now() - req.session.chatgptRequestTime <= 3000) {
        // 不允许在3s里重复调用
        return res.status(429).json({
            msg: "请降低请求频次"
        });
    }
    if (!req.session.chatgptSessionPrompt) {
        req.session.chatgptSessionPrompt = ''
    }
    const wd = req.query.wd;
    const prompt = req.session.chatgptSessionPrompt + `\n提问:` + wd + `\nAI:`
    try {
        const completion = await openai.completions.create({
            model: "text-davinci-003",
            prompt,
            temperature: 0.9,
            max_tokens: 150,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0.6,
            stop: ["\n提问:", "\nAI:"],
            stream: true
        }, { responseType: 'stream' });
        req.session.chatgptRequestTime = Date.now()
        if (!req.session.chatgptTopicCount) {
            req.session.chatgptTopicCount = 1
        } else {
            req.session.chatgptTopicCount += 1
        }
        if (!req.session.chatgptTimes) {
            req.session.chatgptTimes = 1
        } else {
            req.session.chatgptTimes += 1
        }
        res.setHeader("content-type", "text/event-stream")
        completion.data.pipe(res)
    } catch (error) {
        console.error(error)
        res.status(500).json({
            message: "Open AI 调用异常"
        });
    }
});

/**
 * 反馈内容
 */
router.post('/feedback', function(req, res, next) {
    if (req.body.result) {
        req.session.chatgptSessionPrompt += req.body.result
        res.status(200).json({
            code: '0',
            msg: "更新成功"
        });
    } else {
        res.status(400).json({
            msg: "参数错误"
        });
    }
});

/**
 * 换个话题
 */
router.post('/changeTopic', function(req, res, next) {
    req.session.chatgptSessionPrompt = ''
    req.session.chatgptTopicCount = 0
    res.status(200).json({
        code: '0',
        msg: "可以尝试新的话题"
    });
});

/**
 * AI 创作
 * @param {String} prompt 创作提示词
 * @param {String} fileContent 文件内容（可选）
 * @description 使用 DeepSeek API 生成文章内容
 */
router.post('/generate-content', async function(req, res, next) {
    const { prompt, fileContent } = req.body;

    if (!prompt || prompt.trim() === '') {
        return res.status(400).json({
            msg: "请输入创作提示词"
        });
    }

    try {
        // 构建请求体
        const requestBody = {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: '你是一个专业的技术博客作者，擅长将复杂的技术内容转化为清晰、易懂的Markdown格式文章。请按照以下格式输出：\n1. 首先输出文章标题（使用 # 标记）\n2. 然后输出文章摘要（使用 > 标记）\n3. 最后输出文章正文（使用 Markdown 格式）'
                },
                {
                    role: 'user',
                    content: `${prompt}\n\n${fileContent ? '参考文件内容：' + fileContent : ''}`
                }
            ],
            temperature: 0.7,
            max_tokens: 2048,
            stream: true
        };

        // 调用 DeepSeek API
        const response = await fetch(deepSeekApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepSeekApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error('DeepSeek API 调用失败');
        }

        // 流式返回响应
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
        }

        res.end();
    } catch (error) {
        console.error('生成内容失败:', error);
        res.status(500).json({
            message: "AI 创作失败，请重试"
        });
    }
});

module.exports = router;