import { useEffect, useState } from "react";
import { useChat } from "@livekit/components-react";

export function ChatNotification() {
  const { chatMessages } = useChat();
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    if (chatMessages.length === 0) return;
    const last = chatMessages[chatMessages.length - 1];
    if (!last?.message || last.message.startsWith("__")) return;

    const id = Date.now();
    setToast({ text: last.message, id });

    const timer = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 5000);

    return () => clearTimeout(timer);
  }, [chatMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.5rem] z-20 flex justify-center px-4 sm:bottom-[6.5rem]">
      <div className="max-w-lg animate-[slide-up_0.3s_ease-out] rounded-full bg-black/70 px-6 py-2.5 text-center text-sm text-white backdrop-blur-md">
        {toast.text}
      </div>
    </div>
  );
}