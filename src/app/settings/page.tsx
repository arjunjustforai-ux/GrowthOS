"use client";

import React from "react";
import { checkLLM, type LLMAvailability } from "@/lib/llm/client";
import { PageHeader } from "@/components/nav/AppShell";
import {
  Badge,
  Button,
  Callout,
  Card,
  Field,
  Input,
  LinkButton,
  Modal,
} from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

export default function SettingsPage() {
  const { settings, updateSettings, resetDemo, plans, analytics, ready } = useWorkspace();
  const [llm, setLlm] = React.useState<LLMAvailability | null>(null);
  const [confirm, setConfirm] = React.useState(false);

  React.useEffect(() => {
    void checkLLM().then(setLlm);
  }, []);

  if (!ready) return null;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Settings"
        title="Workspace"
        description="GrowthOS is a single-workspace demo product. There is no account system, no multi-user roles and no integrations — those are explicit non-goals for this MVP."
        actions={<LinkButton href="/admin">Demo analytics</LinkButton>}
      />

      <div className="mx-auto max-w-3xl space-y-5 px-5 py-8 sm:px-8">
        <Card className="px-5 py-5">
          <h2 className="font-serif text-lg text-navy-800">Approver</h2>
          <p className="mt-1 text-sm leading-relaxed text-navy-400">
            The name written into the approval record on every proposal.
          </p>
          <div className="mt-4 max-w-sm">
            <Field label="Default approver name">
              <Input
                value={settings.approverName}
                onChange={(e) => updateSettings({ approverName: e.target.value })}
                className="!font-sans"
              />
            </Field>
          </div>
        </Card>

        <Card className="px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg text-navy-800">AI copy assistance</h2>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-navy-400">
                Optional. The recommendation engine, reasoning trace, budget model and guardrail
                critic are deterministic and never call a model. A configured LLM is used only to
                re-phrase creative copy the engine has already decided on.
              </p>
            </div>
            {llm ? (
              <Badge tone={llm.available ? "success" : "outline"}>
                {llm.available ? "Enabled" : "Not configured"}
              </Badge>
            ) : null}
          </div>

          {llm ? (
            <Callout tone={llm.available ? "success" : "quiet"} className="mt-4">
              {llm.reason}
              {llm.available && llm.model ? (
                <p className="mt-1 font-mono text-xs">
                  {llm.provider} · {llm.model}
                </p>
              ) : null}
            </Callout>
          ) : null}

          <div className="mt-4 rounded-lg border border-line bg-ivory-50 px-4 py-3">
            <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-navy-400">
              To enable
            </p>
            <pre className="mt-2 overflow-x-auto font-mono text-xs leading-relaxed text-navy-600">{`# .env.local
LLM_PROVIDER=anthropic   # or openai
LLM_API_KEY=...
# LLM_MODEL=claude-sonnet-5`}</pre>
            <p className="mt-2 text-xs leading-relaxed text-navy-400">
              Keys are read server-side only and never reach the browser. With no key set, every
              demo path still works.
            </p>
          </div>
        </Card>

        <Card className="px-5 py-5">
          <h2 className="font-serif text-lg text-navy-800">Demo state</h2>
          <p className="mt-1 text-sm leading-relaxed text-navy-400">
            The workspace lives in this browser&rsquo;s local storage. Nothing is sent anywhere.
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">
                Plans stored
              </dt>
              <dd className="tnum mt-1 font-serif text-2xl text-navy-800">{plans.length}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">
                Events recorded
              </dt>
              <dd className="tnum mt-1 font-serif text-2xl text-navy-800">{analytics.length}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-[0.09em] text-navy-400">
                Demo banner
              </dt>
              <dd className="mt-1">
                <label className="flex items-center gap-2 text-[13px] text-navy-600">
                  <input
                    type="checkbox"
                    checked={settings.showDemoBanner}
                    onChange={(e) => updateSettings({ showDemoBanner: e.target.checked })}
                    className="h-4 w-4 rounded border-line-strong accent-accent-600"
                  />
                  Show in sidebar
                </label>
              </dd>
            </div>
          </dl>
          <Button variant="danger" className="mt-5" onClick={() => setConfirm(true)}>
            Reset demo
          </Button>
        </Card>

        <Card className="px-5 py-5">
          <h2 className="font-serif text-lg text-navy-800">Explicit non-goals</h2>
          <p className="mt-1 text-sm leading-relaxed text-navy-400">
            Things GrowthOS deliberately does not do, so that it does one thing well.
          </p>
          <ul className="mt-3 grid gap-1.5 text-[13px] leading-relaxed text-navy-600 sm:grid-cols-2">
            {[
              "Publish to Meta or Google",
              "Launch or pause campaigns",
              "Move budget automatically",
              "Optimise campaigns in real time",
              "Act as a CRM",
              "Multi-user roles and permissions",
              "Email or social scheduling",
              "Lead scoring",
              "SEO content generation",
              "A full probabilistic simulator",
              "An integrations marketplace",
              "A mobile app",
            ].map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset the demo?"
        description="Clears every plan, override and analytics event from this browser and rebuilds the seeded history."
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                resetDemo();
                setConfirm(false);
                window.location.href = "/";
              }}
            >
              Reset demo
            </Button>
          </>
        }
      />
    </div>
  );
}
