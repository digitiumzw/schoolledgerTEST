export type PlanTier = "Free" | "Starter" | "Pro" | "Enterprise";
export type SchoolStatus = "Active" | "Trial" | "Suspended";
export type SubscriptionStatus = "Active" | "Past Due" | "Canceled";
export type InvoiceStatus = "Paid" | "Pending" | "Failed";

export interface School {
  id: string;
  name: string;
  logo: string;
  plan: PlanTier;
  students: number;
  teachers: number;
  status: SchoolStatus;
  mrr: number;
  joined: string;
  region: string;
  country: string;
  adminEmail: string;
  storageGb: number;
}

const regions = ["North America", "Europe", "Asia", "Africa", "South America", "Oceania"];
const countries = ["USA", "UK", "Germany", "France", "India", "Japan", "Brazil", "Kenya", "Nigeria", "Australia", "Canada", "Spain"];
const plans: PlanTier[] = ["Free", "Starter", "Pro", "Enterprise"];
const statuses: SchoolStatus[] = ["Active", "Active", "Active", "Active", "Trial", "Trial", "Suspended"];
const planPrice: Record<PlanTier, number> = { Free: 0, Starter: 49, Pro: 199, Enterprise: 799 };

const schoolNames = [
  "Bright Horizon Academy", "Northgate International", "Meridian Prep School", "Cedarwood High",
  "Aurora Learning Center", "Lighthouse Charter", "Riverside Montessori", "Summit Hills Academy",
  "Evergreen Elementary", "Phoenix Tech School", "Hillcrest Public", "Maple Grove Institute",
  "Oakridge Global", "Sunrise Academy", "Galaxy STEM School", "Pinecrest College Prep",
  "Harborview Lyceum", "Westwood Christian", "Greenfield Day School", "Crestview International",
  "Silverlake Academy", "Heritage Hall", "Atlas Online School", "Beacon Hill Prep",
];

function rand(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const r = rand(42);

export const schools: School[] = schoolNames.map((name, i) => {
  const plan = plans[Math.floor(r() * plans.length)];
  const status = statuses[Math.floor(r() * statuses.length)];
  const students = Math.floor(r() * 2400) + 60;
  const teachers = Math.floor(students / (8 + r() * 12));
  const monthsAgo = Math.floor(r() * 36);
  const joined = new Date(2024, 11 - monthsAgo, Math.floor(r() * 28) + 1).toISOString().slice(0, 10);
  return {
    id: `sch_${(i + 1).toString().padStart(4, "0")}`,
    name,
    logo: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    plan,
    students,
    teachers,
    status,
    mrr: status === "Suspended" ? 0 : planPrice[plan],
    joined,
    region: regions[Math.floor(r() * regions.length)],
    country: countries[Math.floor(r() * countries.length)],
    adminEmail: `admin@${name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12)}.edu`,
    storageGb: Math.floor(r() * 480) + 8,
  };
});

export const kpis = {
  totalSchools: schools.length,
  activeSubscriptions: schools.filter((s) => s.status === "Active").length,
  mrr: schools.reduce((sum, s) => sum + s.mrr, 0),
  totalStudents: schools.reduce((sum, s) => sum + s.students, 0),
  churnRate: 2.4,
};

export const revenueTrend = [
  { month: "May", revenue: 18420, expenses: 6200 },
  { month: "Jun", revenue: 21380, expenses: 6800 },
  { month: "Jul", revenue: 24910, expenses: 7100 },
  { month: "Aug", revenue: 28640, expenses: 7600 },
  { month: "Sep", revenue: 31250, expenses: 8200 },
  { month: "Oct", revenue: 34780, expenses: 8800 },
  { month: "Nov", revenue: 39120, expenses: 9400 },
  { month: "Dec", revenue: 42870, expenses: 10100 },
  { month: "Jan", revenue: 46200, expenses: 10600 },
  { month: "Feb", revenue: 49850, expenses: 11200 },
  { month: "Mar", revenue: 53400, expenses: 11800 },
  { month: "Apr", revenue: 58920, expenses: 12400 },
];

export const newSchoolsTrend = [
  { month: "May", schools: 3 },
  { month: "Jun", schools: 5 },
  { month: "Jul", schools: 4 },
  { month: "Aug", schools: 7 },
  { month: "Sep", schools: 6 },
  { month: "Oct", schools: 9 },
  { month: "Nov", schools: 8 },
  { month: "Dec", schools: 11 },
  { month: "Jan", schools: 10 },
  { month: "Feb", schools: 13 },
  { month: "Mar", schools: 15 },
  { month: "Apr", schools: 18 },
];

export const planDistribution = plans.map((p) => ({
  name: p,
  value: schools.filter((s) => s.plan === p).length,
}));

export const recentActivity = [
  { id: 1, type: "signup", text: "Bright Horizon Academy signed up", plan: "Pro", time: "2m ago" },
  { id: 2, type: "upgrade", text: "Cedarwood High upgraded to Enterprise", plan: "Enterprise", time: "1h ago" },
  { id: 3, type: "payment_failed", text: "Payment failed for Riverside Montessori", plan: "Starter", time: "3h ago" },
  { id: 4, type: "cancel", text: "Atlas Online School canceled subscription", plan: "Pro", time: "5h ago" },
  { id: 5, type: "signup", text: "Galaxy STEM School signed up", plan: "Starter", time: "8h ago" },
  { id: 6, type: "upgrade", text: "Harborview Lyceum upgraded to Pro", plan: "Pro", time: "Yesterday" },
  { id: 7, type: "signup", text: "Sunrise Academy signed up", plan: "Free", time: "Yesterday" },
];

export const planTiers = [
  {
    name: "Free" as PlanTier,
    price: 0,
    cycle: "forever",
    description: "Perfect for tiny schools getting started.",
    features: ["Up to 50 students", "1 admin user", "Basic reports", "Community support"],
    limits: { students: 50, teachers: 5, storage: 1 },
  },
  {
    name: "Starter" as PlanTier,
    price: 49,
    cycle: "month",
    description: "For small private schools and tutoring centers.",
    features: ["Up to 300 students", "5 admin users", "Attendance & grading", "Email support"],
    limits: { students: 300, teachers: 25, storage: 20 },
  },
  {
    name: "Pro" as PlanTier,
    price: 199,
    cycle: "month",
    description: "Best for growing K–12 schools.",
    features: ["Up to 1,500 students", "Unlimited admins", "Parent portal", "Priority support", "API access"],
    limits: { students: 1500, teachers: 120, storage: 100 },
    popular: true,
  },
  {
    name: "Enterprise" as PlanTier,
    price: 799,
    cycle: "month",
    description: "Full platform for large districts and networks.",
    features: ["Unlimited students", "SSO & SCIM", "Custom integrations", "Dedicated CSM", "SLA 99.99%"],
    limits: { students: -1, teachers: -1, storage: -1 },
  },
];

export interface Invoice {
  id: string;
  school: string;
  amount: number;
  status: InvoiceStatus;
  date: string;
  plan: PlanTier;
}

export const invoices: Invoice[] = schools.slice(0, 18).map((s, i) => {
  const statuses: InvoiceStatus[] = ["Paid", "Paid", "Paid", "Paid", "Pending", "Failed"];
  return {
    id: `INV-2024-${(1000 + i).toString()}`,
    school: s.name,
    amount: s.mrr || 49,
    status: statuses[i % statuses.length],
    date: new Date(2025, 3, 28 - i).toISOString().slice(0, 10),
    plan: s.plan,
  };
});

export interface Subscription {
  id: string;
  school: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  renewal: string;
  amount: number;
}

export const subscriptions: Subscription[] = schools.map((s, i) => {
  const subStatuses: SubscriptionStatus[] = ["Active", "Active", "Active", "Active", "Past Due", "Canceled"];
  const status = s.status === "Suspended" ? "Canceled" : subStatuses[i % subStatuses.length];
  return {
    id: `sub_${(i + 1).toString().padStart(4, "0")}`,
    school: s.name,
    plan: s.plan,
    status,
    renewal: new Date(2025, 4 + (i % 6), Math.floor((i * 7) % 28) + 1).toISOString().slice(0, 10),
    amount: s.mrr,
  };
});

export const platformGrowth = [
  { month: "May", schools: 110, users: 4200, students: 32000 },
  { month: "Jun", schools: 115, users: 4600, students: 34800 },
  { month: "Jul", schools: 119, users: 5100, students: 37500 },
  { month: "Aug", schools: 126, users: 5650, students: 41200 },
  { month: "Sep", schools: 132, users: 6200, students: 44900 },
  { month: "Oct", schools: 141, users: 6900, students: 48800 },
  { month: "Nov", schools: 149, users: 7500, students: 52400 },
  { month: "Dec", schools: 160, users: 8300, students: 56700 },
  { month: "Jan", schools: 170, users: 9000, students: 60800 },
  { month: "Feb", schools: 183, users: 9850, students: 65300 },
  { month: "Mar", schools: 198, users: 10800, students: 70200 },
  { month: "Apr", schools: 216, users: 11900, students: 75800 },
];

export const geoDistribution = [
  { country: "United States", schools: 68, students: 24800 },
  { country: "United Kingdom", schools: 31, students: 11200 },
  { country: "India", schools: 27, students: 14600 },
  { country: "Germany", schools: 22, students: 8400 },
  { country: "Canada", schools: 18, students: 6900 },
  { country: "Australia", schools: 14, students: 5100 },
  { country: "Brazil", schools: 12, students: 5800 },
  { country: "France", schools: 11, students: 4200 },
  { country: "Kenya", schools: 8, students: 3400 },
  { country: "Japan", schools: 5, students: 1900 },
];