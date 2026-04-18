import React, { useState } from "react";
import ChatBubble from "../../components/dashboard/ChatBubble";
import InspectorPanel from "../../components/dashboard/InspectorPanel";
import { Paperclip, Send } from "lucide-react";

const SecureChat = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      author: "ai",
      text: "Hello! How can I help you today?",
    },
  ]);
  const [inspectionData, setInspectionData] = useState(null);

  const handleSendMessage = (text) => {
    const userMessage = { id: Date.now(), author: "user", text };
    setMessages((prev) => [...prev, userMessage]);

    // Simulate guardrail interception and AI response
    setTimeout(() => {
      const guardMessage = {
        id: Date.now() + 1,
        author: "guard",
        text: "Analyzing for risks...",
      };
      setMessages((prev) => [...prev, guardMessage]);

      // Simulate inspection
      const riskScore = Math.floor(Math.random() * 100);
      let decision = "ALLOWED";
      let riskLevel = "LOW";
      if (riskScore > 90) {
        decision = "BLOCKED";
        riskLevel = "CRITICAL";
      } else if (riskScore > 70) {
        decision = "REDACTED";
        riskLevel = "HIGH";
      } else if (riskScore > 40) {
        riskLevel = "MEDIUM";
      }

      const newInspectionData = {
        riskScore,
        riskLevel,
        decision,
        detectedIssues:
          riskScore > 40
            ? ["Potential PII Leakage", "Prompt Injection Attempt"]
            : [],
        sanitizedInput:
          decision === "REDACTED" ? text.replace(/\d/g, "*") : text,
        outputCheck: "Passed",
      };
      setInspectionData(newInspectionData);

      if (decision === "BLOCKED") {
        const aiMessage = {
          id: Date.now() + 2,
          author: "ai",
          text: "This prompt has been blocked due to security concerns.",
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        const aiMessage = {
          id: Date.now() + 2,
          author: "ai",
          text: `This is a simulated response to: "${newInspectionData.sanitizedInput}"`,
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    }, 500);
  };

  return (
    <div className="flex h-[calc(100vh-10rem)]">
      {/* Chat UI */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-l-lg shadow-md">
        <div className="flex-1 p-6 overflow-y-auto">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} author={msg.author} text={msg.text} />
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              placeholder="Type your message..."
              className="w-full py-3 pl-12 pr-20 rounded-full bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value) {
                  handleSendMessage(e.target.value);
                  e.target.value = "";
                }
              }}
            />
            <button className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-violet-500">
              <Paperclip />
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-violet-500"
              onClick={() => {
                const input = document.querySelector('input[type="text"]');
                if (input.value) {
                  handleSendMessage(input.value);
                  input.value = "";
                }
              }}
            >
              <Send />
            </button>
          </div>
        </div>
      </div>

      {/* Inspector Panel */}
      <div className="w-96 bg-gray-50 dark:bg-gray-800 rounded-r-lg shadow-md p-6 overflow-y-auto">
        <InspectorPanel data={inspectionData} />
      </div>
    </div>
  );
};

export default SecureChat;
