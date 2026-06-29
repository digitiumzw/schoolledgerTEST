import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/studentUtils";

export interface PaymentSnapshotData {
  studentName:   string;
  className:     string;
  balanceBefore: number;
  feeBalanceBefore?: number;       // Fee-only balance before this payment
  transportBalanceBefore?: number; // Transport-only balance before this payment
  paymentMethod: string;
  paymentDate:   string;
  amount:        number;
  category:      string;
  campaignName?: string;
  expectedAmount?: number;
  paidBefore?: number;
  amountPaid?: number;
  remainingAfter?: number;
}

export interface ReceiptData {
  payment: {
    id: string;
    amount: number;
    date: string;
    method: string;
    category: string;
    description: string;
    /** Balance snapshotted when the payment was recorded. Null for legacy payments. */
    balanceAfterPayment?: number | null;
    /** Fee-only balance after this payment. Null for legacy payments. */
    feeBalanceAfterPayment?: number | null;
    /** Transport-only balance after this payment. Null for legacy payments. */
    transportBalanceAfterPayment?: number | null;
    /** Human-readable receipt number (YYYY.MM.DD.HHmmss.X). Null for legacy payments. */
    receiptNumber?: string | null;
    /** Point-in-time data snapshot (feature 057 US5). Null for legacy payments. */
    snapshot?: PaymentSnapshotData | null;
    /** True = user-defined category (non-ledger); no balance block shown. Feature 061. */
    isGeneralPayment?: boolean;
    /** Groups rows from the same multi-category transaction. Feature 061. */
    paymentGroupId?: string | null;
    /** Per-category breakdown for multi-category receipts. Feature 061. */
    categoryLines?: Array<{ category: string; amount: number }>;
    /** Campaign name for fee-campaign payments. Feature 062. */
    campaignName?: string | null;
    /** Campaign expected amount for fee-campaign payments. Feature 062. */
    campaignExpectedAmount?: number | null;
    /** Amount paid before this campaign payment. Feature 062. */
    campaignPaidBefore?: number | null;
    /** True when payment has been voided (feature 085). */
    isVoided?: boolean;
    /** ISO datetime when payment was voided (feature 085). */
    voidedAt?: string | null;
    /** Reason recorded when voiding (feature 085). */
    voidReason?: string | null;
    /** User ID who performed the void (feature 085). */
    voidedBy?: string | null;
  };
  student: {
    firstName: string;
    lastName: string;
    admissionNumber?: string;
    className?: string;
  } | null;
  school: { name: string };
}

interface ReceiptDocumentProps {
  data: ReceiptData;
  receiptUrl: string;
}

export function ReceiptDocument({ data, receiptUrl }: ReceiptDocumentProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Generate QR as a PNG data URL so it survives DOM serialisation (printing).
  useEffect(() => {
    if (!receiptUrl) return;
    QRCode.toDataURL(receiptUrl, {
      width: 96,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [receiptUrl]);

  const { payment, student, school } = data;
  const balance = payment.isGeneralPayment ? null : (payment.balanceAfterPayment ?? null);
  const feeBalance = payment.feeBalanceAfterPayment ?? null;
  const transportBalance = payment.transportBalanceAfterPayment ?? null;
  const hasCategoryLines = Array.isArray(payment.categoryLines) && payment.categoryLines.length > 1;
  const studentName = student
    ? `${student.firstName} ${student.lastName}`
    : "—";

  // Always evaluate both fee and transport balances (they may both be relevant even if this receipt was for one category)
  // For split-category payments, show each category even if the remaining balance is $0.00
  const showFeeBalance = !payment.isGeneralPayment && feeBalance !== null && (feeBalance !== 0 || hasCategoryLines);
  const showTransportBalance = !payment.isGeneralPayment && transportBalance !== null && (transportBalance !== 0 || hasCategoryLines);

  // Determine if the student's total balance is negative
  // Use total balance if available, otherwise fall back to category-specific logic for legacy payments
  const hasNegativeBalance = !payment.isGeneralPayment && (
    (balance !== null && balance < 0) || // Total balance is negative (preferred)
    (balance === null && showFeeBalance && feeBalance < 0) || // Legacy: fee balance negative
    (balance === null && showTransportBalance && transportBalance < 0) // Legacy: transport balance negative
  );

  // Determine if the student's total balance is exactly zero (CLEARED).
  // Requires at least one non-null balance data point — legacy payments with all-null
  // balances must NOT be stamped CLEARED just because we have no data.
  const hasAnyBalanceData = balance !== null || feeBalance !== null || transportBalance !== null;
  const isBalanceCleared = !payment.isGeneralPayment && !hasNegativeBalance && hasAnyBalanceData && (
    (balance !== null && balance === 0) ||
    (balance === null &&
      (feeBalance === null || feeBalance === 0) &&
      (transportBalance === null || transportBalance === 0))
  );

  return (
    <div
      id="receipt-document"
      style={{
        background: "#ffffff",
        color: "#000000",
        fontFamily: "Arial, Helvetica, sans-serif",
        width: "320px",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* CANCELED banner */}
      {payment.isVoided && (
        <div
          style={{
            background: "#fef2f2",
            border: "2px solid #ef4444",
            borderRadius: "6px",
            padding: "12px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "800",
              color: "#dc2626",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            CANCELED / INVALID
          </div>
          {payment.voidedAt && (
            <div style={{ fontSize: "10px", color: "#991b1b", marginTop: "4px" }}>
              Voided on {format(new Date(payment.voidedAt), "dd MMM yyyy 'at' HH:mm")}
            </div>
          )}
          {payment.voidReason && (
            <div style={{ fontSize: "10px", color: "#7f1d1d", marginTop: "2px" }}>
              Reason: {payment.voidReason}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "16px", opacity: payment.isVoided ? 0.5 : 1 }}>
        <div
          style={{
            fontSize: "16px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {school.name}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#6b7280",
            marginTop: "2px",
            letterSpacing: "0.08em",
          }}
        >
          OFFICIAL PAYMENT RECEIPT
        </div>
      </div>

      <Divider />

      {/* Receipt meta */}
      <div style={{ fontSize: "11px", marginBottom: "12px", opacity: payment.isVoided ? 0.5 : 1 }}>
        <Row
          label="Receipt #"
          value={payment.receiptNumber ?? payment.id}
          mono
        />
        <Row label="Date" value={format(new Date(payment.date), "dd MMM yyyy")} />
      </div>

      <Divider />

      {/* Student info */}
      <div style={{ fontSize: "11px", marginBottom: "12px", opacity: payment.isVoided ? 0.5 : 1 }}>
        <Row label="Student" value={studentName} />
        {student?.admissionNumber && (
          <Row label="Admission #" value={student.admissionNumber} />
        )}
        {student?.className && (
          <Row label="Class" value={student.className} />
        )}
      </div>

      <Divider />

      {/* Payment details */}
      <div style={{ fontSize: "11px", marginBottom: "12px", opacity: payment.isVoided ? 0.5 : 1 }}>
        {hasCategoryLines ? (
          payment.categoryLines!.map((line, i) => (
            <Row
              key={i}
              label={i === 0 ? "Categories" : ""}
              value={`${line.category}: ${formatCurrency(line.amount)}`}
              strikethrough={payment.isVoided}
            />
          ))
        ) : (
          payment.category && <Row label="Category" value={payment.category} />
        )}
        {payment.description && <Row label="Notes" value={payment.description} />}
        <Row label="Method" value={payment.method} />
      </div>

      {/* Amount paid — prominent box */}
      <div
        style={{
          background: payment.isVoided ? "#f3f4f6" : "#f9fafb",
          border: payment.isVoided ? "1px solid #d1d5db" : "1px solid #e5e7eb",
          borderRadius: "6px",
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: (!isBalanceCleared && (showFeeBalance || showTransportBalance || (balance !== null && balance !== 0) || (!!payment.campaignName && balance !== null))) ? "8px" : "16px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: "600", color: payment.isVoided ? "#9ca3af" : "#374151" }}>
          Amount Paid
        </span>
        <span style={{ fontSize: "20px", fontWeight: "700", color: payment.isVoided ? "#9ca3af" : "#111827", textDecoration: payment.isVoided ? "line-through" : "none" }}>
          {formatCurrency(payment.amount)}
        </span>
      </div>

      {/* Balance snapshot at the moment this payment was recorded */}
      {!isBalanceCleared && (showFeeBalance || showTransportBalance || (balance !== null && balance !== 0)) && (
        <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Fee Balance - shown for fee or transport+fees payments */}
          {showFeeBalance && (
            <>
              <div
                style={{
                  background: feeBalance > 0 ? "#fff7ed" : feeBalance < 0 ? "#f0fdf4" : "#f0fdf4",
                  border: `1px solid ${feeBalance > 0 ? "#fed7aa" : feeBalance < 0 ? "#bbf7d0" : "#bbf7d0"}`,
                  borderRadius: "6px",
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: feeBalance > 0 ? "#9a3412" : feeBalance < 0 ? "#166534" : "#166534",
                  }}
                >
                  {feeBalance > 0 ? "Fees Balance Remaining" : feeBalance < 0 ? "Fees Balance (Overpayment)" : "Fees Balance"}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: feeBalance > 0 ? "#c2410c" : feeBalance < 0 ? "#15803d" : "#15803d",
                  }}
                >
                  {formatCurrency(feeBalance)}
                </span>
              </div>
              {feeBalance < 0 && (
                <div style={{
                  fontSize: "9px",
                  color: "#6b7280",
                  fontStyle: "italic",
                  marginTop: "-4px",
                  marginBottom: "4px",
                  textAlign: "center",
                }}>
                  Negative balance indicates overpayment - credit available for future charges
                </div>
              )}
            </>
          )}

          {/* Transport Balance - shown for transport or transport+fees payments */}
          {showTransportBalance && (
            <>
              <div
                style={{
                  background: transportBalance > 0 ? "#eff6ff" : transportBalance < 0 ? "#f0fdf4" : "#f0fdf4",
                  border: `1px solid ${transportBalance > 0 ? "#bfdbfe" : transportBalance < 0 ? "#bbf7d0" : "#bbf7d0"}`,
                  borderRadius: "6px",
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: transportBalance > 0 ? "#1e40af" : transportBalance < 0 ? "#166534" : "#166534",
                  }}
                >
                  {transportBalance > 0 ? "Transport Balance Remaining" : transportBalance < 0 ? "Transport Balance (Overpayment)" : "Transport Balance"}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: transportBalance > 0 ? "#2563eb" : transportBalance < 0 ? "#15803d" : "#15803d",
                  }}
                >
                  {formatCurrency(transportBalance)}
                </span>
              </div>
              {transportBalance < 0 && (
                <div style={{
                  fontSize: "9px",
                  color: "#6b7280",
                  fontStyle: "italic",
                  marginTop: "-4px",
                  marginBottom: "4px",
                  textAlign: "center",
                }}>
                  Negative balance indicates overpayment - credit available for future charges
                </div>
              )}
            </>
          )}

          {/* Campaign Balance — shown for fee-campaign payments */}
          {!!payment.campaignName && balance !== null && (
            <>
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#92400e",
                  }}
                >
                  {payment.campaignName} Balance Remaining
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#b45309",
                  }}
                >
                  {formatCurrency(balance)}
                </span>
              </div>
              {(payment.campaignExpectedAmount != null || payment.campaignPaidBefore != null) && (
                <div style={{
                  fontSize: "9px",
                  color: "#6b7280",
                  fontStyle: "italic",
                  marginTop: "-4px",
                  marginBottom: "4px",
                  textAlign: "center",
                }}>
                  Expected {formatCurrency(payment.campaignExpectedAmount ?? 0)} · Paid {formatCurrency((payment.campaignPaidBefore ?? 0) + payment.amount)}
                </div>
              )}
            </>
          )}

          {/* Legacy: Total Balance (fallback for old payments without separate balances) */}
          {balance !== null && !showFeeBalance && !showTransportBalance && !payment.campaignName && (
            <>
              <div
                style={{
                  background: balance > 0 ? "#fff7ed" : balance < 0 ? "#f0fdf4" : "#f0fdf4",
                  border: `1px solid ${balance > 0 ? "#fed7aa" : balance < 0 ? "#bbf7d0" : "#bbf7d0"}`,
                  borderRadius: "6px",
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: balance > 0 ? "#9a3412" : balance < 0 ? "#166534" : "#166534",
                  }}
                >
                  {balance > 0 ? "Balance Remaining" : balance < 0 ? "Balance (Overpaid)" : "Balance After Payment"}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: balance > 0 ? "#c2410c" : balance < 0 ? "#15803d" : "#15803d",
                  }}
                >
                  {formatCurrency(balance)}
                </span>
              </div>
              {balance < 0 && (
                <div style={{
                  fontSize: "9px",
                  color: "#6b7280",
                  fontStyle: "italic",
                  marginTop: "-4px",
                  marginBottom: "4px",
                  textAlign: "center",
                }}>
                  Negative balance indicates overpayment - credit available for future charges
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PAID / CLEARED stamp — hidden when voided */}
      {!payment.isVoided && (payment.isGeneralPayment || isBalanceCleared) && (
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <span
            style={{
              display: "inline-block",
              border: "2px solid #16a34a",
              color: "#16a34a",
              borderRadius: "4px",
              padding: "2px 16px",
              fontSize: "18px",
              fontWeight: "700",
              letterSpacing: "0.1em",
              opacity: 0.85,
              transform: isBalanceCleared ? "rotate(-2deg)" : "rotate(-3deg)",
            }}
          >
            {isBalanceCleared ? "CLEARED" : "PAID"}
          </span>
        </div>
      )}

      <Divider />

      {/* QR code — rendered as <img> so it prints correctly */}
      <div style={{ textAlign: "center", opacity: payment.isVoided ? 0.4 : 1 }}>
        {qrDataUrl ? (
          <div
            style={{
              display: "inline-block",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "6px",
            }}
          >
            <img
              src={qrDataUrl}
              alt="Receipt QR code"
              width={96}
              height={96}
              style={{ display: "block" }}
            />
          </div>
        ) : (
          <div style={{ width: 108, height: 108, display: "inline-block" }} />
        )}
        <div
          style={{
            fontSize: "9px",
            color: "#9ca3af",
            marginTop: "6px",
            letterSpacing: "0.03em",
          }}
        >
          Scan to view this receipt online
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "16px",
          textAlign: "center",
          fontSize: "9px",
          color: "#9ca3af",
        }}
      >
        {school.name} · {new Date().getFullYear()}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <hr
      style={{ border: "none", borderTop: "1px dashed #d1d5db", margin: "12px 0" }}
    />
  );
}

function Row({
  label,
  value,
  mono,
  strikethrough,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strikethrough?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "4px",
        gap: "8px",
      }}
    >
      <span style={{ color: "#6b7280", flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontWeight: "500",
          textAlign: "right",
          wordBreak: "break-all",
          fontFamily: mono ? "monospace" : undefined,
          fontSize: mono ? "10px" : undefined,
          textDecoration: strikethrough ? "line-through" : "none",
        }}
      >
        {value}
      </span>
    </div>
  );
}
