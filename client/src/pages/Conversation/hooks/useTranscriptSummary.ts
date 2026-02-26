import { useState, useCallback } from "react";

export type SummaryStatus = "idle" | "loading" | "done" | "error";

const SYSTEM_PROMPT = `You are a lead generation assistant. 
Given a conversation transcript between an AI assistant and a prospective customer, extract and format a concise lead summary.

Format your response as clean HTML using only <p>, <ul>, <li>, and <strong> tags.
Include:
- A brief intro sentence about the customer's interest
- A bullet list of key project details captured during the conversation
- A closing sentence about next steps

Keep it friendly and professional. Do not include contact details (those will be collected separately).`;

export const useTranscriptSummary = (openAiApiKey: string | undefined) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("idle");

  const generateSummary = useCallback(async (transcriptChunks: string[]) => {
    const transcript = transcriptChunks.join("").replace(/\s+/g, " ").trim();
    if (!transcript || !openAiApiKey) {
      setSummaryStatus("error");
      return;
    }

    setSummaryStatus("loading");
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Here is the conversation transcript:\n\n${transcript}`,
            },
          ],
          max_tokens: 500,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      setSummary(content);
      setSummaryStatus("done");
    } catch (err) {
      console.error("Failed to generate transcript summary:", err);
      setSummaryStatus("error");
    }
  }, [openAiApiKey]);

  return { summary, summaryStatus, generateSummary };
};
