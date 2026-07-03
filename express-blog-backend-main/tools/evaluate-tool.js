const { Tool } = require('@langchain/core/tools');

/**
 * 内容质量评估工具
 */
class EvaluateTool extends Tool {
    name = "evaluate_content";
    description = "用于评估内容质量。参数: content (要评估的内容), prompt (主题)";

    async _call(input) {
        console.log('[EvaluateTool] 评估内容...');
        const { content, prompt } = JSON.parse(input);
        
        // 这里可以使用另一个 LLM 进行评估
        const evaluationPrompt = `请评估以下内容的质量，从相关性、完整性、准确性、流畅度、深度五个方面评分（1-10分）：

内容：${content}
主题：${prompt}

请以 JSON 格式返回评估结果：
{
  "relevance": 8,
  "completeness": 7,
  "accuracy": 9,
  "fluency": 8,
  "depth": 7,
  "overall": 8
}`;

        // 调用 LLM 进行评估
        const { default: fetch } = await import('node-fetch');
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-d057b13d0ddf4586acec47589cca6f2a'
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: '你是一个专业的内容评估专家' },
                    { role: 'user', content: evaluationPrompt }
                ],
                temperature: 0.3,
                max_tokens: 500
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

module.exports = EvaluateTool;