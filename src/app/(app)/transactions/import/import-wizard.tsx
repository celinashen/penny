"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  compactInputClass,
  compactPrimaryClass,
  compactSecondaryClass,
} from "@/components/form-styles";
import { countryName, guessCategory } from "@/lib/categorize";
import {
  MAX_IMPORT_ROWS,
  detectFormat,
  findHeaderRow,
  guessColumns,
  guessHeaderless,
  normalizeRows,
  parseCsvText,
  type ColumnConfig,
  type Grid,
} from "@/lib/csv-import";
import type { Currency } from "@/lib/accounts";
import { formatMoney } from "@/lib/transactions";
import { importTransactions, type ImportResult } from "./actions";

type AccountOption = { id: string; name: string; currency: Currency };

const card =
  "rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,21,18,0.04),0_8px_24px_-12px_rgba(14,21,18,0.08)] sm:p-7";

export function ImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [fileName, setFileName] = useState<string | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [config, setConfig] = useState<ColumnConfig | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const parsed = useMemo(() => {
    if (!grid) return null;
    const headerIndex = findHeaderRow(grid);
    const hasHeader = headerIndex >= 0;
    const headers = hasHeader
      ? grid[headerIndex]
      : Array.from({ length: Math.max(...grid.map((r) => r.length)) }, (_, i) => `Column ${i + 1}`);
    const data = grid.slice(hasHeader ? headerIndex + 1 : 0);
    return { headers, data, hasHeader };
  }, [grid]);

  const normalized = useMemo(
    () => (parsed && config ? normalizeRows(parsed.data, config, 1) : null),
    [parsed, config],
  );

  const totals = useMemo(() => {
    let out = 0;
    let inflow = 0;
    for (const r of normalized?.rows ?? []) {
      if (r.amount < 0) out += -r.amount;
      else inflow += r.amount;
    }
    return { out, inflow };
  }, [normalized]);

  async function onFile(file: File | undefined) {
    setResult(null);
    setFileError(null);
    setGrid(null);
    setConfig(null);
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setFileError("That file is larger than 4 MB. Export a shorter date range.");
      return;
    }
    const g = parseCsvText(await file.text());
    if (g.length < 2) {
      setFileError("That file looks empty, or isn’t a CSV.");
      return;
    }
    const headerIndex = findHeaderRow(g);
    const data = g.slice(headerIndex >= 0 ? headerIndex + 1 : 0);
    const initial =
      headerIndex >= 0 ? guessColumns(g[headerIndex]) : guessHeaderless(data);
    setFileName(file.name);
    setGrid(g);
    setConfig(detectFormat(data, initial));
  }

  const set = <K extends keyof ColumnConfig>(key: K, value: ColumnConfig[K]) =>
    setConfig((c) => (c ? { ...c, [key]: value } : c));

  const numberField = (key: keyof ColumnConfig) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    set(key, Number(e.target.value) as never);

  const columnOptions = (allowNone = false) => (
    <>
      <option value={-1}>{allowNone ? "None" : "Choose a column…"}</option>
      {parsed?.headers.map((h, i) => (
        <option key={i} value={i}>
          {i + 1}. {h || "(blank)"}
        </option>
      ))}
    </>
  );

  const ready =
    normalized && normalized.rows.length > 0 && normalized.rows.length <= MAX_IMPORT_ROWS;

  function submit() {
    if (!normalized) return;
    startTransition(async () => {
      setResult(await importTransactions({ accountId, rows: normalized.rows }));
    });
  }

  function reset() {
    setResult(null);
    setGrid(null);
    setConfig(null);
    setFileName(null);
  }

  if (result && !result.error) {
    return (
      <section className={card}>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          Imported {result.imported?.toLocaleString("en-US")} transaction
          {result.imported === 1 ? "" : "s"}
        </h2>
        <ul className="mt-4 flex flex-col gap-1.5 text-muted">
          {!!result.duplicates && (
            <li>
              {result.duplicates.toLocaleString("en-US")} already imported, so skipped.
            </li>
          )}
          {!!result.abroad && (
            <li>
              {result.abroad} purchase{result.abroad === 1 ? "" : "s"} made abroad, filed
              under Travel with the country in the note.
            </li>
          )}
          {!!result.needsReview && (
            <li>
              {result.needsReview} money-in row{result.needsReview === 1 ? "" : "s"} couldn&rsquo;t
              be categorized. Find them under &ldquo;Uncategorized&rdquo;.
            </li>
          )}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/transactions" className={`${compactPrimaryClass} inline-block`}>
            View transactions
          </Link>
          <button type="button" onClick={reset} className={compactSecondaryClass}>
            Import another file
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h2 className="mb-5 text-xl font-semibold tracking-[-0.02em]">1. Account and file</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Import into
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={compactInputClass}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            CSV file
            <input
              type="file"
              accept=".csv,text/csv,.txt"
              onChange={(e) => onFile(e.target.files?.[0])}
              className={`${compactInputClass} py-2 file:mr-3 file:rounded-full file:border-0 file:bg-raised file:px-3 file:py-1 file:text-sm file:font-medium`}
            />
          </label>
        </div>
        {fileError && (
          <p role="alert" className="mt-3 text-sm text-negative">
            {fileError}
          </p>
        )}
      </section>

      {parsed && config && normalized && (
        <>
          <section className={card}>
            <h2 className="mb-1 text-xl font-semibold tracking-[-0.02em]">2. Check the columns</h2>
            <p className="mb-5 text-sm text-muted">
              {fileName}: {parsed.data.length.toLocaleString("en-US")} rows
              {parsed.hasHeader ? "" : ", no header row found so columns were guessed"}. Change
              anything that looks wrong.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Date
                <select value={config.dateCol} onChange={numberField("dateCol")} className={compactInputClass}>
                  {columnOptions()}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Description
                <select value={config.descCol} onChange={numberField("descCol")} className={compactInputClass}>
                  {columnOptions()}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
                Amounts are in
                <select
                  value={config.amountMode}
                  onChange={(e) => set("amountMode", e.target.value as ColumnConfig["amountMode"])}
                  className={compactInputClass}
                >
                  <option value="single">One column</option>
                  <option value="split">Separate debit and credit columns</option>
                </select>
              </label>

              {config.amountMode === "single" ? (
                <>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Amount
                    <select value={config.amountCol} onChange={numberField("amountCol")} className={compactInputClass}>
                      {columnOptions()}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    In this file, a purchase is a
                    <select
                      value={config.spendingSign}
                      onChange={(e) => set("spendingSign", e.target.value as ColumnConfig["spendingSign"])}
                      className={compactInputClass}
                    >
                      <option value="negative">negative number (-12.50)</option>
                      <option value="positive">positive number (12.50)</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Debit (money out)
                    <select value={config.debitCol} onChange={numberField("debitCol")} className={compactInputClass}>
                      {columnOptions()}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Credit (money in)
                    <select value={config.creditCol} onChange={numberField("creditCol")} className={compactInputClass}>
                      {columnOptions()}
                    </select>
                  </label>
                </>
              )}

              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Category (optional)
                <select value={config.categoryCol} onChange={numberField("categoryCol")} className={compactInputClass}>
                  {columnOptions(true)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Dates are written
                <select
                  value={config.dateOrder}
                  onChange={(e) => set("dateOrder", e.target.value as ColumnConfig["dateOrder"])}
                  className={compactInputClass}
                >
                  <option value="mdy">month first (12/31/2026)</option>
                  <option value="dmy">day first (31/12/2026)</option>
                </select>
              </label>
            </div>
          </section>

          <section className={card}>
            <h2 className="mb-1 text-xl font-semibold tracking-[-0.02em]">3. Preview</h2>
            <p className="mb-4 text-sm text-muted">
              {normalized.rows.length.toLocaleString("en-US")} ready
              {normalized.skipped.length > 0 && `, ${normalized.skipped.length} can’t be read`}.
              Money out {formatMoney(totals.out, account.currency)}, money in{" "}
              {formatMoney(totals.inflow, account.currency)}. Categories shown are best guesses
              and can be changed afterwards.
            </p>

            {normalized.rows.length > MAX_IMPORT_ROWS && (
              <p role="alert" className="mb-4 text-sm text-negative">
                That&rsquo;s more than {MAX_IMPORT_ROWS.toLocaleString("en-US")} rows. Export a
                shorter date range.
              </p>
            )}

            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="bg-raised/60 font-mono text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2 font-normal">Date</th>
                    <th className="px-3 py-2 font-normal">Description</th>
                    <th className="px-3 py-2 text-right font-normal">Amount</th>
                    <th className="px-3 py-2 font-normal">Filed under</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {normalized.rows.slice(0, 8).map((r, i) => {
                    const g = guessCategory({ description: r.description, amount: r.amount });
                    return (
                      <tr key={i}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{r.date}</td>
                        <td className="max-w-[16rem] truncate px-3 py-2">{r.description}</td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${r.amount > 0 ? "text-positive" : ""}`}
                        >
                          {formatMoney(r.amount, account.currency, true)}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {r.category || g.category || <span className="text-warn">Needs review</span>}
                          {g.country ? ` · ${countryName(g.country)}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {normalized.skipped.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium text-warn">
                  {normalized.skipped.length} row{normalized.skipped.length === 1 ? "" : "s"} will be skipped
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-muted">
                  {normalized.skipped.slice(0, 8).map((s) => (
                    <li key={s.line}>
                      Row {s.line}: {s.reason}
                    </li>
                  ))}
                  {normalized.skipped.length > 8 && <li>and {normalized.skipped.length - 8} more</li>}
                </ul>
              </details>
            )}
          </section>

          {result?.error && (
            <p role="alert" className="text-sm text-negative">
              {result.error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!ready || pending}
              className={compactPrimaryClass}
            >
              {pending
                ? "Importing…"
                : `Import ${normalized.rows.length.toLocaleString("en-US")} transactions`}
            </button>
            <Link href="/transactions" className={compactSecondaryClass}>
              Cancel
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
