import { ChatInterface } from '@/components/ChatInterface'
import { UploadZone } from '@/components/UploadZone'
import { Separator } from '@/components/ui/separator'
import { BookOpen } from 'lucide-react'

export default function ChatPage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b bg-card px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight">Training Assistant</h1>
            <p className="text-xs text-muted-foreground leading-tight">AI-powered Q&amp;A from your materials</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — upload */}
        <aside className="w-72 shrink-0 border-r flex flex-col overflow-y-auto bg-card">
          <div className="px-4 pt-4 pb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Training Materials
            </p>
          </div>
          <Separator />
          <div className="px-4 py-4 flex-1">
            <UploadZone />
          </div>
        </aside>

        {/* Chat panel */}
        <main className="flex-1 overflow-hidden">
          <ChatInterface />
        </main>
      </div>
    </div>
  )
}
