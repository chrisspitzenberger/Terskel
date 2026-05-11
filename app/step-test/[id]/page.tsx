import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStepTestAction } from "@/lib/actions/step-tests"
import { StepTestDetailClient } from "@/components/step-test/step-test-detail-client"

export default async function StepTestDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const test = await getStepTestAction(params.id)

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Test nicht gefunden</p>
        <Button asChild>
          <Link href="/step-test">Zur Übersicht</Link>
        </Button>
      </div>
    )
  }

  return <StepTestDetailClient test={test} />
}
