import { MessagesSquare } from "lucide-react";

export default function ChatIndexPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <MessagesSquare className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">Select a channel</p>
      <p className="mt-1 text-sm text-muted-foreground">Or create a new one to start chatting with your team.</p>
    </div>
  );
}
