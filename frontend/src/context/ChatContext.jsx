import { createContext, useContext } from "react"

import { useChat } from "../hooks/useChat"

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const value = useChat()
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  const value = useContext(ChatContext)
  if (!value) {
    throw new Error("useChatContext must be used inside ChatProvider")
  }
  return value
}
