import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Build an array of "YYYY-MM" strings going back `count` months from today. */
function buildMonthOptions(count = 13): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }

  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

interface MonthFilterProps {
  value: string;
  onChange: (month: string) => void;
}

export function MonthFilter({ value, onChange }: MonthFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-[200px]">
        <SelectValue placeholder="Select month" />
      </SelectTrigger>
      <SelectContent>
        {MONTH_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
