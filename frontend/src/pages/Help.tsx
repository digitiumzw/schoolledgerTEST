import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Menu, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHelpSearch } from '@/hooks/useHelpSearch';
import { useActiveSection } from '@/hooks/useActiveSection';
import { helpContent } from '@/lib/helpContent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import HelpTableOfContents from '@/components/help/HelpTableOfContents';
import HelpTopicComponent from '@/components/help/HelpTopic';

export default function Help() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialScrollDone = useRef(false);

  const userRole = user?.role || 'admin';

  const {
    filteredSections,
    searchQuery,
    setSearchQuery,
    hasResults,
  } = useHelpSearch(helpContent.sections, userRole);

  const sectionIds = filteredSections.map((s) => s.id);
  const topicIds = filteredSections.flatMap((s) => s.topics.map((t) => t.id));
  const allIds = [...sectionIds, ...topicIds];

  const { activeSectionId } = useActiveSection(allIds);

  // Handle contextual navigation (?section= or ?topic=)
  useEffect(() => {
    if (initialScrollDone.current) return;

    const targetSection = searchParams.get('section');
    const targetTopic = searchParams.get('topic');
    const targetId = targetTopic || targetSection;

    if (targetId) {
      const element = document.getElementById(targetId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          initialScrollDone.current = true;
        }, 300);
      }
    }

    // Clean up query params after scroll
    if (targetSection || targetTopic) {
      setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 500);
    }
  }, [searchParams, setSearchParams]);

  const handleSectionClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [mobileOpen, setMobileOpen] = useState(false);

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    bursar: 'Bursar',
    teacher: 'Teacher',
  };

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8 max-w-7xl">
      {/* Hero header */}
      <div className="mb-10 rounded-2xl bg-gradient-to-br from-primary/5 via-primary/5 to-transparent border border-primary/10 p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Help Center</h1>
            </div>
            <p className="text-muted-foreground max-w-lg">
              Role-based user guide for {user?.name || 'your school'}. Content is scoped to your permissions.
            </p>
          </div>
          <Badge
            variant="secondary"
            className="w-fit self-start sm:self-center text-sm px-3 py-1.5 capitalize"
          >
            {roleLabels[userRole] || userRole}
            <span className="text-muted-foreground ml-1.5">role</span>
          </Badge>
        </div>

        {/* Mobile TOC trigger */}
        <div className="mt-5 flex items-center gap-3 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Menu className="h-4 w-4" />
                Browse topics
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 pt-4">
              <SheetHeader className="px-4 pb-2 border-b text-left">
                <SheetTitle className="text-sm">Help Topics</SheetTitle>
                <SheetDescription className="text-xs">Jump to a section</SheetDescription>
              </SheetHeader>
              <div className="px-4 py-4">
                <HelpTableOfContents
                  sections={filteredSections}
                  activeSectionId={activeSectionId}
                  onSectionClick={(id) => {
                    handleSectionClick(id);
                    setMobileOpen(false);
                  }}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>
            </SheetContent>
          </Sheet>
          {searchQuery && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              <span className={cn('font-medium', !hasResults && 'text-destructive')}>
                {hasResults
                  ? `${filteredSections.reduce((acc, s) => acc + s.topics.length, 0)} result${filteredSections.reduce((acc, s) => acc + s.topics.length, 0) !== 1 ? 's' : ''}`
                  : 'No results'}
              </span>
              <Button variant="ghost" size="sm" className="h-auto py-0 px-1 text-xs" onClick={() => setSearchQuery('')}>
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">
        {/* Left: Table of Contents (desktop only) */}
        <aside className="hidden lg:block lg:w-80 shrink-0">
          <div className="sticky top-24">
            <HelpTableOfContents
              sections={filteredSections}
              activeSectionId={activeSectionId}
              onSectionClick={handleSectionClick}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resultCount={hasResults
                ? filteredSections.reduce((acc, s) => acc + s.topics.length, 0)
                : 0}
            />
          </div>
        </aside>

        {/* Right: Content */}
        <main className="flex-1 min-w-0">
          {!hasResults ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 py-20 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No results found</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                We couldn't find anything matching &quot;{searchQuery}&quot;. Try a different keyword or clear your search.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <div className="space-y-16">
              {filteredSections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-28"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-8 w-1 rounded-full bg-primary/20" />
                    <div>
                      <h2 className="text-xl lg:text-2xl font-bold text-foreground">
                        {section.heading}
                      </h2>
                      {section.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-6">
                    {section.topics.map((topic) => (
                      <HelpTopicComponent
                        key={topic.id}
                        topic={topic}
                        searchQuery={searchQuery}
                        user={user}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
