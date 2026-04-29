export default function OfflinePage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-4xl font-extrabold tracking-tight text-foreground mb-3">VotRO</div>
      <p className="text-muted text-sm max-w-xs">
        Nu există conexiune la internet. Datele vor apărea când revii online.
      </p>
    </div>
  )
}
