import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { HelpSection } from '@/types/help';
import * as Icons from 'lucide-react';

interface HelpTableOfContentsProps {
  sections: HelpSection[];
  activeSectionId: string | null;
  onSectionClick: (sectionId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount?: number;
}

function getIcon(iconName: string | undefined) {
  if (!iconName) return null;
  const IconComponent = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
  if (!IconComponent) return null;
  return <IconComponent className="h-4 w-4 shrink-0" />;
}

export default function HelpTableOfContents({
  sections,
  activeSectionId,
  onSectionClick,
  searchQuery,
  onSearchChange,
  resultCount,
}: HelpTableOfContentsProps) {
  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search help topics..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9 rounded-lg"
          aria-label="Search help topics"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {resultCount !== undefined && resultCount > 0 && searchQuery && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="h-5 px-2 text-[11px]">
            {resultCount} result{resultCount !== 1 ? 's' : ''}
          </Badge>
          <span>for &quot;{searchQuery}&quot;</span>
        </div>
      )}

      {/* Section list */}
      <nav aria-label="Help table of contents">
        <ul className="space-y-3">
          {sections.map((section) => {
            const isActive = activeSectionId === section.id;
            const hasActiveTopic = section.topics.some((t) => t.id === activeSectionId);
            return (
              <li key={section.id}>
                <button
                  onClick={() => onSectionClick(section.id)}
                  className={cn(
                    'group w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all text-left',
                    isActive
                      ? 'bg-primary/8 text-primary font-semibold shadow-sm'
                      : 'text-foreground/80 hover:bg-muted/80 hover:text-foreground'
                  )}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                      isActive || hasActiveTopic
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/15'
                    )}
                  >
                    {getIcon(section.icon) || (
                      <span className="text-[10px] font-bold">{section.heading.charAt(0).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="truncate">{section.heading}</span>
                </button>

                {/* Topic sub-list */}
                {section.topics.length > 0 && (
                  <ul className="relative ml-[22px] mt-1 space-y-0.5 border-l-2 border-border/60 pl-4">
                    {section.topics.map((topic) => {
                      const topicActive = activeSectionId === topic.id;
                      return (
                        <li key={topic.id}>
                          <button
                            onClick={() => onSectionClick(topic.id)}
                            className={cn(
                              'w-full rounded-md px-2.5 py-1.5 text-xs text-left transition-colors relative',
                              topicActive
                                ? 'text-primary font-medium bg-primary/5'
                                : 'text-muted-foreground/80 hover:text-foreground hover:bg-muted/50'
                            )}
                          >
                            {topicActive && (
                              <span className="absolute -left-[19px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                            {topic.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
