
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { AlertTriangle } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-4xl font-bold mb-2">404 - Page Not Found</h1>
      <p className="text-lg text-muted-foreground mb-6">Oops! The page you're looking for doesn't exist.</p>
      <Button asChild>
        <Link href="/dashboard">Go Back to Dashboard</Link>
      </Button>
    </div>
  )
}
