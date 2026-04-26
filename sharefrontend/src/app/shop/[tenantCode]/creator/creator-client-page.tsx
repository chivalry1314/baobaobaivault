"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ShareApiError, shareApi } from "@/lib/share-api";
import type { DashboardCard, DashboardStats, PublicCardItem, SessionUser } from "@/lib/shared";

type CardDraft = {
  title: string;
  description: string;
  isPublic: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString();
}

function formatUsage(maxUses: number | null, usedCount: number) {
  if (maxUses === null) {
    return `${usedCount} / Unlimited`;
  }
  return `${usedCount} / ${maxUses}`;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Max uses must be a positive number.");
  }

  return Math.floor(parsed);
}

function buildDrafts(cards: DashboardCard[]) {
  return cards.reduce<Record<string, CardDraft>>((result, item) => {
    result[item.card.id] = {
      title: item.card.title,
      description: item.card.description,
      isPublic: item.card.isPublic,
    };
    return result;
  }, {});
}

export default function CreatorClientPage({ tenantCode }: { tenantCode: string }) {
  const [sessionChecking, setSessionChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardsError, setCardsError] = useState("");

  const [drafts, setDrafts] = useState<Record<string, CardDraft>>({});
  const [savingCardId, setSavingCardId] = useState("");
  const [deletingCardId, setDeletingCardId] = useState("");
  const [saveCardError, setSaveCardError] = useState("");
  const [saveCardSuccess, setSaveCardSuccess] = useState("");

  const [publicCards, setPublicCards] = useState<PublicCardItem[]>([]);
  const [loadingPublicCards, setLoadingPublicCards] = useState(false);
  const [publicCardsError, setPublicCardsError] = useState("");

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadIsPublic, setUploadIsPublic] = useState(true);
  const [uploadMaxUses, setUploadMaxUses] = useState("");
  const [uploadExpiresAt, setUploadExpiresAt] = useState("");
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [selectedCardId, setSelectedCardId] = useState("");
  const [newCodeMaxUses, setNewCodeMaxUses] = useState("");
  const [newCodeExpiresAt, setNewCodeExpiresAt] = useState("");
  const [createCodePending, setCreateCodePending] = useState(false);
  const [createCodeError, setCreateCodeError] = useState("");
  const [createCodeSuccess, setCreateCodeSuccess] = useState("");

  const selectedCard = useMemo(() => {
    return cards.find((item) => item.card.id === selectedCardId) ?? null;
  }, [cards, selectedCardId]);

  const loadDashboard = useCallback(async () => {
    setLoadingCards(true);
    setCardsError("");

    try {
      const data = await shareApi.creatorCards(tenantCode);
      setAuthenticated(true);
      setCurrentUser(data.user);
      setCards(data.cards);
      setStats(data.stats);
      setDrafts(buildDrafts(data.cards));
      setSelectedCardId((current) => {
        if (data.cards.some((item) => item.card.id === current)) {
          return current;
        }
        return data.cards[0]?.card.id ?? "";
      });
    } catch (error) {
      if (error instanceof ShareApiError && error.status === 401) {
        setAuthenticated(false);
        setCurrentUser(null);
        setCards([]);
        setStats(null);
        return;
      }
      if (error instanceof Error) {
        setCardsError(error.message);
      } else {
        setCardsError("Failed to load dashboard.");
      }
    } finally {
      setLoadingCards(false);
    }
  }, [tenantCode]);

  const loadPublicCards = useCallback(async () => {
    setLoadingPublicCards(true);
    setPublicCardsError("");

    try {
      const payload = await shareApi.browseCards(tenantCode);
      setPublicCards(payload.cards);
    } catch (error) {
      if (error instanceof ShareApiError && error.status === 401) {
        setPublicCards([]);
        return;
      }
      if (error instanceof Error) {
        setPublicCardsError(error.message);
      } else {
        setPublicCardsError("Failed to load public cards.");
      }
    } finally {
      setLoadingPublicCards(false);
    }
  }, [tenantCode]);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const payload = await shareApi.session(tenantCode);

        if (!active) {
          return;
        }

        if (!payload.authenticated || !payload.user) {
          setAuthenticated(false);
          setCurrentUser(null);
          return;
        }

        setAuthenticated(true);
        setCurrentUser(payload.user);
        await Promise.all([loadDashboard(), loadPublicCards()]);
      } catch {
        if (active) {
          setAuthenticated(false);
          setCurrentUser(null);
        }
      } finally {
        if (active) {
          setSessionChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [tenantCode, loadDashboard, loadPublicCards]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthPending(true);
    setAuthError("");

    try {
      const payload = await shareApi.login(tenantCode, {
        username: loginUsername,
        password: loginPassword,
      });
      setAuthenticated(true);
      setCurrentUser(payload.user);
      setLoginPassword("");
      await Promise.all([loadDashboard(), loadPublicCards()]);
    } catch (error) {
      if (error instanceof Error) {
        setAuthError(error.message);
      } else {
        setAuthError("Login failed.");
      }
    } finally {
      setAuthPending(false);
      setSessionChecking(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthPending(true);
    setAuthError("");

    try {
      const payload = await shareApi.register(tenantCode, {
        username: registerUsername,
        displayName: registerDisplayName,
        password: registerPassword,
      });
      setAuthenticated(true);
      setCurrentUser(payload.user);
      setRegisterPassword("");
      await Promise.all([loadDashboard(), loadPublicCards()]);
    } catch (error) {
      if (error instanceof Error) {
        setAuthError(error.message);
      } else {
        setAuthError("Register failed.");
      }
    } finally {
      setAuthPending(false);
      setSessionChecking(false);
    }
  }

  async function handleLogout() {
    await shareApi.logout(tenantCode).catch(() => null);
    setAuthenticated(false);
    setCurrentUser(null);
    setCards([]);
    setStats(null);
    setPublicCards([]);
    setSelectedCardId("");
    setDrafts({});
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!uploadFile) {
      setUploadError("Please select a file.");
      return;
    }

    setUploadPending(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const payload = await shareApi.createCard(tenantCode, {
        title: uploadTitle,
        description: uploadDescription,
        isPublic: uploadIsPublic,
        file: uploadFile,
        maxUses: uploadMaxUses,
        expiresAt: uploadExpiresAt,
      });

      setUploadSuccess(`Uploaded. Initial code: ${payload.code.code}`);
      setUploadTitle("");
      setUploadDescription("");
      setUploadFile(null);
      setUploadIsPublic(true);
      setUploadMaxUses("");
      setUploadExpiresAt("");
      await Promise.all([loadDashboard(), loadPublicCards()]);
    } catch (error) {
      if (error instanceof Error) {
        setUploadError(error.message);
      } else {
        setUploadError("Upload failed.");
      }
    } finally {
      setUploadPending(false);
    }
  }

  async function handleCreateCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCardId) {
      setCreateCodeError("Please select a card.");
      return;
    }

    setCreateCodePending(true);
    setCreateCodeError("");
    setCreateCodeSuccess("");

    try {
      const maxUses = parseOptionalNumber(newCodeMaxUses);
      const payload = await shareApi.createCode(tenantCode, {
        cardId: selectedCardId,
        maxUses,
        expiresAt: newCodeExpiresAt.trim() ? newCodeExpiresAt : null,
      });
      setCreateCodeSuccess(`Code created: ${payload.code.code}`);
      setNewCodeMaxUses("");
      setNewCodeExpiresAt("");
      await loadDashboard();
    } catch (error) {
      if (error instanceof Error) {
        setCreateCodeError(error.message);
      } else {
        setCreateCodeError("Create code failed.");
      }
    } finally {
      setCreateCodePending(false);
    }
  }

  async function handleSaveCard(cardId: string) {
    const draft = drafts[cardId];
    if (!draft || !draft.title.trim()) {
      setSaveCardError("Card title is required.");
      return;
    }

    setSavingCardId(cardId);
    setSaveCardError("");
    setSaveCardSuccess("");

    try {
      await shareApi.updateCard(tenantCode, cardId, draft);
      setSaveCardSuccess("Card updated.");
      await Promise.all([loadDashboard(), loadPublicCards()]);
    } catch (error) {
      if (error instanceof Error) {
        setSaveCardError(error.message);
      } else {
        setSaveCardError("Update failed.");
      }
    } finally {
      setSavingCardId("");
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!window.confirm("Delete this card? This will also remove related download codes and stored file.")) {
      return;
    }

    setDeletingCardId(cardId);
    setSaveCardError("");
    setSaveCardSuccess("");

    try {
      await shareApi.deleteCard(tenantCode, cardId);
      setSaveCardSuccess("Card deleted.");
      await Promise.all([loadDashboard(), loadPublicCards()]);
    } catch (error) {
      if (error instanceof Error) {
        setSaveCardError(error.message);
      } else {
        setSaveCardError("Delete failed.");
      }
    } finally {
      setDeletingCardId("");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between rounded-2xl border border-[var(--outline)] bg-white/80 px-5 py-4">
        <div>
          <h1 className="text-xl font-semibold">Creator Dashboard</h1>
          <p className="text-xs text-[var(--foreground)]/60">Shop: {tenantCode}</p>
          {currentUser ? (
            <p className="text-sm text-[var(--foreground)]/70">
              Signed in as {currentUser.displayName} ({currentUser.username})
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/shop/${encodeURIComponent(tenantCode)}`} className="rounded-full border border-[var(--outline)] px-4 py-2 text-sm">
            Back to shop
          </Link>
          {authenticated ? (
            <button onClick={handleLogout} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white">
              Logout
            </button>
          ) : null}
        </div>
      </header>

      {sessionChecking ? <p className="mt-6">Checking session...</p> : null}

      {!sessionChecking && !authenticated ? (
        <section className="mt-6 rounded-2xl border border-[var(--outline)] bg-white p-5">
          <div className="flex gap-2 text-sm">
            <button onClick={() => setAuthMode("login")} className="rounded border border-[var(--outline)] px-3 py-1">
              Login
            </button>
            <button onClick={() => setAuthMode("register")} className="rounded border border-[var(--outline)] px-3 py-1">
              Register
            </button>
          </div>

          {authMode === "login" ? (
            <form onSubmit={handleLogin} className="mt-4 grid gap-3">
              <input
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                placeholder="Username"
                required
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                placeholder="Password"
                required
              />
              <button type="submit" disabled={authPending} className="rounded bg-[var(--brand)] px-3 py-2 text-sm text-white">
                {authPending ? "Logging in..." : "Login"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="mt-4 grid gap-3">
              <input
                value={registerUsername}
                onChange={(event) => setRegisterUsername(event.target.value)}
                className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                placeholder="Username (3-24 chars: a-z, 0-9, _ -)"
                required
              />
              <input
                value={registerDisplayName}
                onChange={(event) => setRegisterDisplayName(event.target.value)}
                className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                placeholder="Display name"
                required
              />
              <input
                type="password"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                placeholder="Password"
                required
              />
              <button type="submit" disabled={authPending} className="rounded bg-[var(--brand)] px-3 py-2 text-sm text-white">
                {authPending ? "Registering..." : "Register"}
              </button>
            </form>
          )}

          {authError ? <p className="mt-3 text-sm text-[#9a3412]">{authError}</p> : null}
        </section>
      ) : null}

      {authenticated ? (
        <>
          {stats ? (
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--outline)] bg-white p-3 text-sm">Cards: {stats.totalCards}</div>
              <div className="rounded-xl border border-[var(--outline)] bg-white p-3 text-sm">Codes: {stats.totalCodes}</div>
              <div className="rounded-xl border border-[var(--outline)] bg-white p-3 text-sm">Downloads: {stats.totalDownloads}</div>
              <div className="rounded-xl border border-[var(--outline)] bg-white p-3 text-sm">Last 7 days: {stats.last7DaysDownloads}</div>
            </section>
          ) : null}

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-[var(--outline)] bg-white p-5">
              <h2 className="text-lg font-semibold">Upload Card</h2>
              <form onSubmit={handleUpload} className="mt-4 grid gap-3">
                <input
                  value={uploadTitle}
                  onChange={(event) => setUploadTitle(event.target.value)}
                  className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                  placeholder="Title"
                  required
                />
                <textarea
                  value={uploadDescription}
                  onChange={(event) => setUploadDescription(event.target.value)}
                  className="min-h-20 rounded border border-[var(--outline)] px-3 py-2 text-sm"
                  placeholder="Description"
                />
                <input
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                  required
                />
                <label className="flex items-center gap-2 rounded border border-[var(--outline)] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={uploadIsPublic}
                    onChange={(event) => setUploadIsPublic(event.target.checked)}
                  />
                  Public card
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={uploadMaxUses}
                    onChange={(event) => setUploadMaxUses(event.target.value)}
                    className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                    placeholder="Max uses (optional)"
                  />
                  <input
                    type="datetime-local"
                    value={uploadExpiresAt}
                    onChange={(event) => setUploadExpiresAt(event.target.value)}
                    className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploadPending}
                  className="rounded bg-[var(--brand)] px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {uploadPending ? "Uploading..." : "Upload and create initial code"}
                </button>
              </form>
              {uploadError ? <p className="mt-3 text-sm text-[#9a3412]">{uploadError}</p> : null}
              {uploadSuccess ? <p className="mt-3 text-sm text-[#166534]">{uploadSuccess}</p> : null}
            </article>

            <article className="rounded-2xl border border-[var(--outline)] bg-white p-5">
              <h2 className="text-lg font-semibold">Create Extra Download Code</h2>
              <form onSubmit={handleCreateCode} className="mt-4 grid gap-3">
                <select
                  value={selectedCardId}
                  onChange={(event) => setSelectedCardId(event.target.value)}
                  className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                  disabled={cards.length === 0}
                >
                  {cards.length === 0 ? <option value="">No cards yet</option> : null}
                  {cards.map((item) => (
                    <option key={item.card.id} value={item.card.id}>
                      {item.card.title}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={newCodeMaxUses}
                    onChange={(event) => setNewCodeMaxUses(event.target.value)}
                    className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                    placeholder="Max uses (optional)"
                  />
                  <input
                    type="datetime-local"
                    value={newCodeExpiresAt}
                    onChange={(event) => setNewCodeExpiresAt(event.target.value)}
                    className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createCodePending || cards.length === 0}
                  className="rounded bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-60"
                >
                  {createCodePending ? "Creating..." : "Create code"}
                </button>
              </form>
              {selectedCard ? <p className="mt-3 text-xs text-[var(--foreground)]/60">Selected: {selectedCard.card.title}</p> : null}
              {createCodeError ? <p className="mt-3 text-sm text-[#9a3412]">{createCodeError}</p> : null}
              {createCodeSuccess ? <p className="mt-3 text-sm text-[#166534]">{createCodeSuccess}</p> : null}
            </article>
          </section>

          <section className="mt-6 rounded-2xl border border-[var(--outline)] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Cards</h2>
              <button onClick={loadDashboard} className="rounded border border-[var(--outline)] px-3 py-1 text-xs">
                Refresh
              </button>
            </div>

            {loadingCards ? <p className="mt-4 text-sm text-[var(--foreground)]/70">Loading...</p> : null}
            {cardsError ? <p className="mt-4 text-sm text-[#9a3412]">{cardsError}</p> : null}
            {saveCardError ? <p className="mt-4 text-sm text-[#9a3412]">{saveCardError}</p> : null}
            {saveCardSuccess ? <p className="mt-4 text-sm text-[#166534]">{saveCardSuccess}</p> : null}

            {!loadingCards && !cardsError && cards.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--foreground)]/70">No cards yet. Upload one to get started.</p>
            ) : null}

            <div className="mt-4 space-y-4">
              {cards.map((item) => {
                const draft = drafts[item.card.id] ?? {
                  title: item.card.title,
                  description: item.card.description,
                  isPublic: item.card.isPublic,
                };

                return (
                  <article key={item.card.id} className="rounded-xl border border-[var(--outline)] bg-[var(--panel)] p-4">
                    <div className="grid gap-3">
                      <input
                        value={draft.title}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.card.id]: {
                              ...draft,
                              title: event.target.value,
                            },
                          }))
                        }
                        className="rounded border border-[var(--outline)] px-3 py-2 text-sm"
                      />
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.card.id]: {
                              ...draft,
                              description: event.target.value,
                            },
                          }))
                        }
                        className="min-h-16 rounded border border-[var(--outline)] px-3 py-2 text-sm"
                        placeholder="Description"
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.isPublic}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.card.id]: {
                                ...draft,
                                isPublic: event.target.checked,
                              },
                            }))
                          }
                        />
                        Public card
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveCard(item.card.id)}
                          disabled={savingCardId === item.card.id}
                          className="w-fit rounded bg-[var(--brand)] px-3 py-1 text-xs text-white disabled:opacity-60"
                        >
                          {savingCardId === item.card.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => handleDeleteCard(item.card.id)}
                          disabled={deletingCardId === item.card.id}
                          className="w-fit rounded bg-[#b91c1c] px-3 py-1 text-xs text-white disabled:opacity-60"
                        >
                          {deletingCardId === item.card.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-[var(--foreground)]/65">
                      File: {item.card.originalFileName} | Downloads: {item.stats.downloadCount} | Last: {formatDate(item.stats.lastDownloadedAt)}
                    </div>

                    <div className="mt-3 space-y-2">
                      {item.codes.length === 0 ? (
                        <p className="text-xs text-[var(--foreground)]/60">No download codes.</p>
                      ) : (
                        item.codes.map((code) => (
                          <div key={code.id} className="rounded border border-[var(--outline)] bg-white px-3 py-2 text-xs">
                            <p className="font-semibold tracking-[0.08em] text-[var(--brand-strong)]">{code.code}</p>
                            <p>{formatUsage(code.maxUses, code.usedCount)}</p>
                            <p>Expires: {formatDate(code.expiresAt)}</p>
                            <p>Created: {formatDate(code.createdAt)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-[var(--outline)] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Other Public Cards in This Shop</h2>
              <button onClick={loadPublicCards} className="rounded border border-[var(--outline)] px-3 py-1 text-xs">
                Refresh
              </button>
            </div>

            {loadingPublicCards ? <p className="mt-4 text-sm text-[var(--foreground)]/70">Loading...</p> : null}
            {publicCardsError ? <p className="mt-4 text-sm text-[#9a3412]">{publicCardsError}</p> : null}

            {!loadingPublicCards && !publicCardsError && publicCards.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--foreground)]/70">No public cards from other creators.</p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {publicCards.map((item) => (
                <article key={item.card.id} className="rounded-xl border border-[var(--outline)] bg-[var(--panel)] p-4">
                  <p className="text-sm font-semibold">{item.card.title}</p>
                  <p className="mt-1 text-xs text-[var(--foreground)]/65">Creator: {item.creator.displayName}</p>
                  <p className="mt-1 text-xs text-[var(--foreground)]/65">Downloads: {item.stats.downloadCount}</p>
                  <p className="mt-1 text-xs text-[var(--foreground)]/65">Last: {formatDate(item.stats.lastDownloadedAt)}</p>
                  <a
                    href={shareApi.browseDownloadUrl(tenantCode, item.card.id)}
                    className="mt-3 inline-block rounded bg-[var(--accent)] px-3 py-2 text-xs text-white"
                  >
                    Download
                  </a>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
