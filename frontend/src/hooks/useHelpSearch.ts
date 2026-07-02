import { useMemo, useState } from 'react';
import { HelpSection, UserRole } from '@/types/help';

export interface UseHelpSearchReturn {
  filteredSections: HelpSection[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hasResults: boolean;
}

/**
 * Hook to filter help sections by role visibility and search query.
 * Search matches against section heading, topic title, step instructions, and tags.
 */
export function useHelpSearch(
  sections: HelpSection[],
  userRole: UserRole
): UseHelpSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = useMemo(() => {
    // First, filter by role
    const roleFiltered = sections
      .filter((section) => section.roleVisibility.includes(userRole))
      .map((section) => ({
        ...section,
        topics: section.topics.filter((topic) =>
          topic.roleVisibility.includes(userRole)
        ),
      }))
      .filter((section) => section.topics.length > 0);

    // If no search query, return role-filtered content
    if (!searchQuery.trim()) {
      return roleFiltered;
    }

    const query = searchQuery.toLowerCase().trim();

    // Filter by search query
    return roleFiltered
      .map((section) => {
        const matchingTopics = section.topics.filter((topic) => {
          const searchText = [
            section.heading,
            topic.title,
            topic.summary || '',
            ...topic.steps.map((s) => s.instruction),
            ...(topic.steps.map((s) => s.tip || '')),
            ...(topic.prerequisites || []),
            ...(topic.warnings || []),
            ...(topic.notes || []),
            ...(topic.faqs || []).flatMap((f) => [f.question, f.answer]),
            ...(topic.tags || []),
          ]
            .join(' ')
            .toLowerCase();
          return searchText.includes(query);
        });
        return { ...section, topics: matchingTopics };
      })
      .filter((section) => section.topics.length > 0);
  }, [sections, userRole, searchQuery]);

  const hasResults = filteredSections.length > 0;

  return {
    filteredSections,
    searchQuery,
    setSearchQuery,
    hasResults,
  };
}
