import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Plain-language guide to the staff workspace. Static content, no data
// fetches — but rendered dynamically because the staff layout reads auth
// cookies (force-static here breaks the build's prerender pass).
export const dynamic = 'force-dynamic'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-body">{children}</CardContent>
    </Card>
  )
}

export default function StaffHelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">How your workspace works</h1>
        <p className="mt-1 text-sm text-body">
          Everything on this page is safe to try — you can&apos;t break anything.
        </p>
      </div>

      <Section title="The pages">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>My Day</strong> — your overdue / due-today list, with a &ldquo;Next up&rdquo; pick and one-tap buttons. Start here every morning.</li>
          <li><strong>My Work</strong> — your kanban board. Drag cards between columns to update status.</li>
          <li><strong>Department</strong> — (leads only) everything happening in your department, across all clients.</li>
          <li><strong>My Recent</strong> — work you&apos;ve recently submitted.</li>
          <li><strong>Search</strong> — find any of your tasks or past submissions, including completed ones.</li>
          <li><strong>Submit Work</strong> — the form for logging finished work (bottom of My Day).</li>
        </ul>
      </Section>

      <Section title="Tasks, steps, and deliverables — what's the difference?">
        <ul className="list-disc space-y-1 pl-5">
          <li>A <strong>task</strong> is a piece of work assigned to you (e.g. &ldquo;Car Accidents – Georgia&rdquo; landing page).</li>
          <li>A <strong>step</strong> (card marked <em>step</em>) is one stage of a task&apos;s workflow — like &ldquo;SEO Content Writing&rdquo; inside a blog. Steps often have instructions in their description telling you exactly what &ldquo;done&rdquo; means.</li>
          <li>A <strong>deliverable</strong> (card marked <em>deliv</em>) is a monthly package item (e.g. &ldquo;4 blog posts&rdquo;) that counts what you submit.</li>
        </ul>
      </Section>

      <Section title="Statuses">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>To do</strong> → not started. <strong>In progress</strong> → you&apos;re on it.</li>
          <li><strong>In review</strong> → you&apos;re finished and someone else needs to look at it. This is as far as you take a task.</li>
          <li><strong>Paused</strong> → stuck waiting on something. You&apos;ll be asked <em>why</em> — write what it&apos;s waiting on so nobody has to chase you.</li>
          <li><strong>Submitted</strong> → the final sign-off. Only a super-admin or your department lead can move a task here (exception: you can finish your own <em>steps</em>).</li>
          <li>Completed tasks are greyed out. Only a super-admin can reopen one.</li>
        </ul>
      </Section>

      <Section title="Workflows run themselves">
        <p>
          When you finish your step, the next person is <strong>notified automatically</strong> — you don&apos;t
          need to tell them. When the last step is done, the whole task moves to In review on its own.
          So the only thing you ever need to do is finish <em>your</em> step and mark it done.
        </p>
      </Section>

      <Section title="Submitting work">
        <ul className="list-disc space-y-1 pl-5">
          <li>Open a task and hit <strong>&ldquo;Submit work for this task →&rdquo;</strong> — the form comes prefilled. Paste your URL, submit, done.</li>
          <li>Or use the form on My Day directly: pick the firm, the kind of work, paste the link. <strong>Bulk paste</strong> takes many URLs at once (one per line).</li>
          <li>&ldquo;Counts toward&rdquo; connects your submission to the client&apos;s monthly deliverable — pick it when it applies so your work is counted.</li>
          <li>On a <em>deliv</em> card, the <strong>paperclip / Add proof</strong> button does the same thing in one tap.</li>
          <li>Submissions go live to the client immediately — only submit finished work.</li>
        </ul>
      </Section>

      <Section title="Files, comments, and @mentions">
        <ul className="list-disc space-y-1 pl-5">
          <li>Attach <strong>files</strong> (images, video, PDF, Word, CSV, Excel — up to 200MB) on the task detail page.</li>
          <li>Use <strong>comments</strong> on the task for questions and handoffs — not chat — so the context stays with the work.</li>
          <li>Type <strong>@</strong> in a comment to mention someone — they get a notification. &ldquo;@Brittany please review&rdquo; actually pings Brittany.</li>
        </ul>
      </Section>

      <Section title="How you'll be notified">
        <ul className="list-disc space-y-1 pl-5">
          <li>The <strong>bell</strong> (top right) shows assignments, mentions, and &ldquo;your step is ready&rdquo; pings.</li>
          <li>A <strong>morning email</strong> lists anything overdue, due today, or new for you — if there&apos;s nothing, you get no email.</li>
          <li>Priority flags: a <strong>red-tinted card</strong> means urgent/high — it jumps your Next up queue.</li>
        </ul>
      </Section>

      <Section title="Stuck?">
        <p>
          Pause the task with a reason, or comment on it and <strong>@mention your department lead</strong>.
          Either way it&apos;s visible — silent stuck is the only wrong move.
        </p>
      </Section>

      <p className="text-sm text-body">
        <Link href="/staff" className="text-fg-brand hover:underline">← Back to My Day</Link>
      </p>
    </div>
  )
}
