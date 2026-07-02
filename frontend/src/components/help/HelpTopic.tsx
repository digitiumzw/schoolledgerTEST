import { cn } from '@/lib/utils';
import { HelpTopic as HelpTopicType } from '@/types/help';
import type { User } from '@/types/auth';
import ScreenshotPlaceholder from './ScreenshotPlaceholder';
import { Lightbulb, Circle, AlertTriangle, Info, ListChecks, HelpCircle, ArrowUpRight } from 'lucide-react';

interface HelpTopicProps {
  topic: HelpTopicType;
  searchQuery: string;
  user: User | null;
}

function replacePlaceholders(text: string, user: User | null): string {
  const orgName = user?.name || 'your school';
  return text.replace(/\{\{organizationName\}\}/g, orgName);
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (!lowerText.includes(lowerQuery)) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery, lastIndex);

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(
      <mark key={index} className="bg-yellow-200/60 dark:bg-yellow-900/40 rounded px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
    );
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

export default function HelpTopicComponent({ topic, searchQuery, user }: HelpTopicProps) {
  const stepCount = topic.steps.length;

  return (
    <div
      id={topic.id}
      className={cn(
        'scroll-mt-28 rounded-xl border bg-card p-5 sm:p-6 transition-shadow',
        'hover:shadow-sm'
      )}
    >
      {/* Topic title */}
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 flex items-start gap-2">
        <Circle className="h-2 w-2 mt-2.5 shrink-0 fill-primary text-primary" />
        <HighlightText text={topic.title} query={searchQuery} />
      </h3>

      {/* Summary */}
      {topic.summary && (
        <p className="mb-4 pl-4 text-sm text-muted-foreground leading-relaxed">
          <HighlightText text={replacePlaceholders(topic.summary, user)} query={searchQuery} />
        </p>
      )}

      {/* Prerequisites */}
      {topic.prerequisites && topic.prerequisites.length > 0 && (
        <div className="mb-5 rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4 shrink-0 text-primary" />
            Before you start
          </div>
          <ul className="space-y-1.5 pl-1">
            {topic.prerequisites.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                <span>{replacePlaceholders(item, user)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps timeline */}
      <ol className="relative list-none">
        {topic.steps.map((step, idx) => {
          const isLast = idx === stepCount - 1;
          return (
            <li key={step.order} className="relative pl-8 pb-4 last:pb-0">
              {/* Connector line */}
              {!isLast && (
                <span
                  className="absolute left-[11px] top-7 bottom-0 w-px bg-border"
                  aria-hidden="true"
                />
              )}

              {/* Step number */}
              <span
                className={cn(
                  'absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                  'bg-primary text-primary-foreground shadow-sm'
                )}
              >
                {step.order}
              </span>

              <div className="flex-1">
                <p className="text-sm text-foreground leading-relaxed pt-0.5">
                  <HighlightText
                    text={replacePlaceholders(step.instruction, user)}
                    query={searchQuery}
                  />
                </p>

                {step.tip && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span className="leading-relaxed">{step.tip}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Warnings — critical / irreversible cautions */}
      {topic.warnings && topic.warnings.length > 0 && (
        <div className="mt-5 rounded-lg border-l-4 border-red-500 bg-red-50/60 dark:bg-red-950/20 p-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-red-800 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Important warnings
          </div>
          <ul className="space-y-1.5 pl-1">
            {topic.warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-red-900/90 dark:text-red-200/90 leading-relaxed">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                <span>{replacePlaceholders(warning, user)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes — helpful notes, limitations, best practices */}
      {topic.notes && topic.notes.length > 0 && (
        <div className="mt-5 rounded-lg border-l-4 border-blue-400 bg-blue-50/60 dark:bg-blue-950/20 p-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
            <Info className="h-4 w-4 shrink-0" />
            Notes &amp; best practices
          </div>
          <ul className="space-y-1.5 pl-1">
            {topic.notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-blue-900/90 dark:text-blue-200/90 leading-relaxed">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                <span>{replacePlaceholders(note, user)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FAQs */}
      {topic.faqs && topic.faqs.length > 0 && (
        <div className="mt-5 pt-5 border-t border-dashed border-border/60">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground">
            <HelpCircle className="h-4 w-4 shrink-0 text-primary" />
            Frequently asked questions
          </div>
          <dl className="space-y-3">
            {topic.faqs.map((faq, i) => (
              <div key={i} className="rounded-lg bg-muted/40 p-3">
                <dt className="text-sm font-medium text-foreground">
                  <HighlightText text={faq.question} query={searchQuery} />
                </dt>
                <dd className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  <HighlightText text={replacePlaceholders(faq.answer, user)} query={searchQuery} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Related topics — cross-links */}
      {topic.related && topic.related.length > 0 && (
        <div className="mt-5 pt-5 border-t border-dashed border-border/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Related topics</p>
          <div className="flex flex-wrap gap-2">
            {topic.related.map((link) => (
              <a
                key={link.topicId}
                href={`#${link.topicId}`}
                className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                {link.label}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      )}

      {topic.screenshotCaption && (
        <div className="mt-5 pt-5 border-t border-dashed border-border/60">
          <ScreenshotPlaceholder caption={topic.screenshotCaption} />
        </div>
      )}
    </div>
  );
}
