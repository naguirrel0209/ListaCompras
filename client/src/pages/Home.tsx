import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownAZ, ArrowUpAZ, CalendarDays, Check, ChevronDown, CircleCheckBig, Clipboard, Copy, Flag, Filter, History,
  ListPlus, Loader2, LogOut, PackagePlus, Pencil, Plus, RotateCcw, Search, ShoppingBasket,
  SlidersHorizontal, Sparkles, Sun, Moon, Tags, Trash2, UsersRound, X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type ViewStatus = "pending" | "completed" | "archived" | "all";
type SortBy = "priority" | "deadline" | "newest" | "oldest" | "nameAsc" | "nameDesc";
type ItemPriority = "critical" | "high" | "medium" | "low";

const priorities: Array<{ value: ItemPriority; label: string; detail: string }> = [
  { value: "critical", label: "Crítica", detail: "Resolver hoy" },
  { value: "high", label: "Alta", detail: "Muy importante" },
  { value: "medium", label: "Media", detail: "Compra habitual" },
  { value: "low", label: "Baja", detail: "Puede esperar" },
];
const statusLabels: Record<ViewStatus, string> = { pending: "Pendientes", completed: "Comprados", archived: "Retirados", all: "Todo" };
const sortOptions: Array<{ value: SortBy; label: string }> = [
  { value: "priority", label: "Por prioridad" },
  { value: "deadline", label: "Fecha límite cercana" },
  { value: "oldest", label: "Más antiguos primero" },
  { value: "nameAsc", label: "Nombre: A–Z" },
  { value: "nameDesc", label: "Nombre: Z–A" },
];

function formatQuantity(value: string | number) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function parseTags(tagsJson: string) {
  try {
    const tags = JSON.parse(tagsJson);
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function friendlyError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Algo no salió como esperábamos. Vuelve a intentarlo.";
}

function priorityInfo(priority: ItemPriority) {
  return priorities.find(item => item.value === priority) ?? priorities[2];
}

function priorityClass(priority: ItemPriority) {
  return ({ critical: "bg-[#ffe1da] text-[#b44938]", high: "bg-[#fff0cf] text-[#9a6620]", medium: "bg-[#e7f2ea] text-[#347653]", low: "bg-[#e8edf4] text-[#55718d]" } as const)[priority];
}

function dateInputValue(value: Date | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function deadlineText(value: Date | null) {
  if (!value) return "Sin fecha límite";
  const date = new Date(value);
  return `Comprar antes del ${date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
}

export default function Home() {
  const familyQuery = trpc.family.current.useQuery(undefined, { retry: false, refetchOnWindowFocus: true });

  if (familyQuery.isLoading && !familyQuery.error) {
    return <LoadingScreen />;
  }

  if (familyQuery.error && !familyQuery.error.message.includes("Ingresa a tu familia") && !familyQuery.error.message.includes("sesión")) {
    return <ConnectionError title="No pudimos abrir tu lista" description="Comprueba tu conexión y vuelve a intentarlo." onRetry={() => familyQuery.refetch()} />;
  }

  return familyQuery.data ? <FamilyDashboard family={familyQuery.data} /> : <WelcomeScreen />;
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="rise-in flex flex-col items-center gap-4 text-center">
        <div className="grid size-16 place-items-center rounded-[1.6rem] bg-[#d9efdf] text-primary soft-shadow"><ShoppingBasket className="size-8" /></div>
        <Loader2 className="size-5 animate-spin text-primary" aria-label="Cargando" />
        <p className="text-sm font-medium text-muted-foreground">Abriendo tu lista familiar…</p>
      </div>
    </main>
  );
}

function WelcomeScreen() {
  const utils = trpc.useUtils();
  const { theme, toggleTheme } = useTheme();
  const singleFamilyMode = import.meta.env.VITE_SINGLE_FAMILY_MODE === "true";
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [createForm, setCreateForm] = useState({ familyName: "", memberName: "", password: "", confirmation: "", initialListName: "Compra semanal" });
  const [joinForm, setJoinForm] = useState({ inviteCode: "", password: "", memberName: "" });
  const [singleForm, setSingleForm] = useState({ memberName: "" });
  const [formError, setFormError] = useState("");

  const singleAccess = trpc.family.singleAccess.useMutation({
    onSuccess: async result => {
      toast.success(`Hola, ${result.memberName}`, { description: "Tu lista familiar está lista." });
      await utils.family.current.invalidate();
    },
    onError: error => setFormError(friendlyError(error)),
  });
  const create = trpc.family.create.useMutation({
    onSuccess: async result => {
      toast.success("La familia ya está lista", { description: `Código compartible: ${result.family.inviteCode}` });
      await utils.family.current.invalidate();
    },
    onError: error => setFormError(friendlyError(error)),
  });
  const join = trpc.family.join.useMutation({
    onSuccess: async result => {
      toast.success(`Bienvenida, ${result.memberName}`, { description: "Tu lista se ha actualizado." });
      await utils.family.current.invalidate();
    },
    onError: error => setFormError(friendlyError(error)),
  });

  const createFamily = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (createForm.password !== createForm.confirmation) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }
    await create.mutateAsync({
      familyName: createForm.familyName,
      memberName: createForm.memberName,
      password: createForm.password,
      initialListName: createForm.initialListName,
    });
  };

  const accessSingleFamily = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    await singleAccess.mutateAsync({ memberName: singleForm.memberName });
  };

  const joinFamily = async (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    await join.mutateAsync({
      inviteCode: joinForm.inviteCode.trim().toUpperCase(),
      password: joinForm.password,
      memberName: joinForm.memberName,
    });
  };

  return (
    <main className="theme-page relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute -left-16 top-24 size-44 rounded-full bg-[#f6d39e]/55 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-[28rem] size-64 rounded-full bg-[#bfe1cf]/55 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col justify-between gap-10">
        <header className="flex items-center justify-between rise-in">
          <Brand />
          <div className="flex items-center gap-2"><span className="hidden rounded-full bg-white/65 px-3 py-1.5 text-xs font-semibold text-[#667066] shadow-sm sm:inline">Compras en equipo</span><button onClick={toggleTheme} className="grid size-10 place-items-center rounded-xl bg-white/65 text-[#657060] shadow-sm transition-colors hover:bg-white" aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}>{theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}</button></div>
        </header>

        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div className="rise-in max-w-2xl" style={{ animationDelay: "60ms" }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e7c58d]/55 bg-[#fff7e8]/80 px-3 py-1.5 text-xs font-bold tracking-wide text-[#855b22]">
              <Sparkles className="size-3.5" /> Todo lo que hace falta, juntos
            </div>
            <h1 className="font-display text-5xl leading-[.98] tracking-[-.055em] text-[#3b4036] sm:text-6xl lg:text-7xl">
              Comprar en familia, <span className="text-[#438866]">sin perder el hilo.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
              {singleFamilyMode ? "Escribe tu nombre y entra directo a la lista compartida de casa." : "Una lista compartida, cálida y sencilla para que cada compra llegue a casa. Comparte el código con quien quieras."}
            </p>
            <div className="mt-7 grid max-w-lg grid-cols-3 gap-3 text-center text-xs font-semibold text-[#5c6759] sm:gap-4">
              <FeaturePill icon={<UsersRound className="size-4" />} text="Una familia" />
              <FeaturePill icon={<ListPlus className="size-4" />} text="Varias listas" />
              <FeaturePill icon={<CircleCheckBig className="size-4" />} text="Al día" />
            </div>
          </div>

          <section className="theme-surface paper-grain rise-in rounded-[2rem] border border-white/75 bg-[#fffdf8]/90 p-5 soft-shadow backdrop-blur sm:p-7" style={{ animationDelay: "130ms" }} aria-label="Acceso a Lista Familiar">
            {singleFamilyMode ? (
              <form onSubmit={accessSingleFamily} className="space-y-4">
                <div className="mb-7">
                  <p className="mb-2 text-xs font-bold tracking-[.1em] text-[#548061] uppercase">Lista de casa</p>
                  <h2 className="font-display text-3xl tracking-[-.045em] text-[#3f483b]">¿Quién está entrando?</h2>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">Escribe tu nombre para continuar con la lista familiar.</p>
                </div>
                <TextField label="Tu nombre" value={singleForm.memberName} onChange={value => setSingleForm({ memberName: value })} placeholder="Ej. Marta" autoFocus />
                {formError && <FormError message={formError} />}
                <Button type="submit" className="h-12 w-full rounded-2xl bg-[#438866] text-sm font-bold hover:bg-[#367653]" disabled={singleAccess.isPending}>
                  {singleAccess.isPending ? <Loader2 className="size-4 animate-spin" /> : <UsersRound className="size-4" />} Entrar a la lista
                </Button>
              </form>
            ) : mode === "choose" && <ChooseAccess onCreate={() => { setFormError(""); setMode("create"); }} onJoin={() => { setFormError(""); setMode("join"); }} />}
            {!singleFamilyMode && mode === "create" && (
              <form onSubmit={createFamily} className="space-y-4">
                <FormHeading kicker="Tu rincón compartido" title="Crea tu familia" onBack={() => setMode("choose")} />
                <TextField label="Nombre de la familia" value={createForm.familyName} onChange={value => setCreateForm({ ...createForm, familyName: value })} placeholder="Ej. Casa Moreno" autoFocus />
                <TextField label="¿Cómo te llamamos?" value={createForm.memberName} onChange={value => setCreateForm({ ...createForm, memberName: value })} placeholder="Ej. Marta" />
                <TextField label="Primera lista" value={createForm.initialListName} onChange={value => setCreateForm({ ...createForm, initialListName: value })} placeholder="Compra semanal" />
                <div className="rounded-2xl bg-[#f6f3eb] p-3.5">
                  <p className="mb-3 text-xs font-semibold text-[#596254]">Contraseña compartida <span className="font-normal text-muted-foreground">(opcional)</span></p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField compact label="Contraseña" type="password" value={createForm.password} onChange={value => setCreateForm({ ...createForm, password: value })} placeholder="Déjala vacía si quieres" />
                    <TextField compact label="Repetir contraseña" type="password" value={createForm.confirmation} onChange={value => setCreateForm({ ...createForm, confirmation: value })} placeholder="Una vez más" />
                  </div>
                </div>
                {formError && <FormError message={formError} />}
                <Button type="submit" className="h-12 w-full rounded-2xl bg-[#438866] text-sm font-bold hover:bg-[#367653]" disabled={create.isPending}>
                  {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Crear mi lista familiar
                </Button>
              </form>
            )}
            {!singleFamilyMode && mode === "join" && (
              <form onSubmit={joinFamily} className="space-y-4">
                <FormHeading kicker="Qué alegría verte" title="Únete a una familia" onBack={() => setMode("choose")} />
                <TextField label="Código familiar" value={joinForm.inviteCode} onChange={value => setJoinForm({ ...joinForm, inviteCode: value.toUpperCase() })} placeholder="CASA-1234" autoFocus className="font-mono uppercase tracking-[.12em]" />
                <TextField label="¿Cómo te llamamos?" value={joinForm.memberName} onChange={value => setJoinForm({ ...joinForm, memberName: value })} placeholder="Ej. Dani" />
                <TextField label="Contraseña compartida" type="password" value={joinForm.password} onChange={value => setJoinForm({ ...joinForm, password: value })} placeholder="Solo si la familia usa una" />
                {formError && <FormError message={formError} />}
                <Button type="submit" className="h-12 w-full rounded-2xl bg-[#438866] text-sm font-bold hover:bg-[#367653]" disabled={join.isPending}>
                  {join.isPending ? <Loader2 className="size-4 animate-spin" /> : <UsersRound className="size-4" />} Entrar a la lista
                </Button>
              </form>
            )}
          </section>
        </section>

        <p className="rise-in text-center text-xs leading-5 text-muted-foreground" style={{ animationDelay: "220ms" }}>
          {singleFamilyMode ? "El acceso está limitado a la familia configurada en el servidor." : "Quien tenga el código —y la contraseña, si existe— podrá consultar y actualizar las listas."}
        </p>
      </div>
    </main>
  );
}

function FamilyDashboard({ family }: { family: { family: { id: string; name: string; inviteCode: string; hasPassword: boolean }; memberName: string } }) {
  const utils = trpc.useUtils();
  const { theme, toggleTheme } = useTheme();
  const [activeListId, setActiveListId] = useState("");
  const [status, setStatus] = useState<ViewStatus>("pending");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<ItemPriority | "">("");
  const [tag, setTag] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [showFilters, setShowFilters] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; quantity: string; priority: ItemPriority; deadline: string; note: string; tags: string[] } | null>(null);
  const [archivingItem, setArchivingItem] = useState<{ id: string; name: string } | null>(null);
  const [removingList, setRemovingList] = useState<{ id: string; name: string } | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newItem, setNewItem] = useState({ name: "", quantity: "1", priority: "medium" as ItemPriority, deadline: new Date().toISOString().slice(0, 10), note: "", tags: "" });
  const [archiveReason, setArchiveReason] = useState("");

  const listsQuery = trpc.lists.all.useQuery(undefined, { refetchInterval: 5000, refetchOnWindowFocus: true });
  const activeList = activeListId || listsQuery.data?.[0]?.id || "";
  const activeListName = listsQuery.data?.find(list => list.id === activeList)?.name ?? "esta lista";
  const filters = useMemo(() => ({
    listId: activeList || undefined,
    status,
    priority: priorityFilter || undefined,
    tag: tag || undefined,
    search: search.trim() || undefined,
    sortBy,
  }), [activeList, priorityFilter, search, sortBy, status, tag]);
  const itemsQuery = trpc.items.all.useQuery(filters, { enabled: Boolean(activeList), refetchInterval: 5000, refetchOnWindowFocus: true });
  const activityQuery = trpc.activities.recent.useQuery({ limit: 18 }, { refetchInterval: 9000, refetchOnWindowFocus: true });

  const refresh = async () => {
    await Promise.all([utils.items.all.invalidate(), utils.lists.all.invalidate(), utils.activities.recent.invalidate(), utils.family.current.invalidate()]);
  };
  const createList = trpc.lists.create.useMutation({ onSuccess: async list => { await refresh(); setActiveListId(list.id); setNewListName(""); setShowNewList(false); toast.success("Nueva lista creada", { description: `“${list.name}” ya está preparada.` }); }, onError: error => toast.error("No pudimos crear la lista", { description: friendlyError(error) }) });
  const addItem = trpc.items.create.useMutation({ onSuccess: async item => { await refresh(); setNewItem({ name: "", quantity: "1", priority: "medium", deadline: new Date().toISOString().slice(0, 10), note: "", tags: "" }); toast.success("Artículo añadido", { description: `${item.name} aparece en la lista.` }); }, onError: error => toast.error("Revisa el artículo", { description: friendlyError(error) }) });
  const updateItem = trpc.items.update.useMutation({ onSuccess: async () => { await refresh(); setEditingItem(null); toast.success("Artículo actualizado"); }, onError: error => toast.error("No pudimos guardar los cambios", { description: friendlyError(error) }) });
  const removeList = trpc.lists.remove.useMutation({ onSuccess: async result => { await refresh(); setActiveListId(""); setRemovingList(null); toast.success("Lista eliminada", { description: `“${result.listName}” ya no aparece entre tus listas.` }); }, onError: error => toast.error("No pudimos eliminar la lista", { description: friendlyError(error) }) });
  const toggleItem = trpc.items.toggle.useMutation({ onSuccess: async result => { await refresh(); toast.success(result?.item.status === "completed" ? "Marcado como comprado" : "Vuelve a estar pendiente", { description: result?.item.name }); }, onError: error => toast.error("No pudimos cambiar el estado", { description: friendlyError(error) }) });
  const archiveItem = trpc.items.archive.useMutation({ onSuccess: async () => { await refresh(); setArchivingItem(null); setArchiveReason(""); toast.success("Artículo retirado de la lista"); }, onError: error => toast.error("Indica un motivo", { description: friendlyError(error) }) });
  const restoreItem = trpc.items.restore.useMutation({ onSuccess: async item => { await refresh(); toast.success("Artículo restaurado", { description: item?.item.name }); }, onError: error => toast.error("No pudimos restaurarlo", { description: friendlyError(error) }) });
  const logout = trpc.family.logout.useMutation({ onSuccess: async () => { await utils.family.current.invalidate(); toast.success("Has salido de la familia"); } });

  if (listsQuery.error) {
    return <ConnectionError title="No pudimos cargar tus listas" description="La familia está a salvo; solo necesitamos volver a conectar." onRetry={() => listsQuery.refetch()} />;
  }

  const pendingCount = listsQuery.data?.length ? (itemsQuery.data ?? []).filter(entry => entry.item.status === "pending").length : 0;
  const allTags = Array.from(new Set((itemsQuery.data ?? []).flatMap(entry => parseTags(entry.item.tagsJson)))).sort((a, b) => a.localeCompare(b, "es"));
  const submitNewItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeList) return;
    const normalizedTags = newItem.tags.split(",").map(value => value.trim()).filter(Boolean);
    await addItem.mutateAsync({ listId: activeList, name: newItem.name, quantity: Number(newItem.quantity), priority: newItem.priority, deadline: new Date(`${newItem.deadline}T12:00:00`), note: newItem.note, tags: normalizedTags });
  };
  const clearFilters = () => { setStatus("pending"); setSearch(""); setPriorityFilter(""); setTag(""); setSortBy("priority"); };
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(family.family.inviteCode); toast.success("Código copiado", { description: "Ya puedes compartirlo." }); }
    catch { toast.error("No pudimos copiar el código", { description: "Puedes seleccionarlo y copiarlo manualmente." }); }
  };

  return (
    <main className="theme-page min-h-screen px-3 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-6xl pb-10">
        <header className="theme-surface paper-grain rise-in sticky top-3 z-30 flex items-center justify-between gap-3 rounded-[1.65rem] border border-white/80 bg-[#fffdf8]/90 px-4 py-3 soft-shadow backdrop-blur sm:px-5">
          <Brand compact />
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="theme-icon-control grid size-10 place-items-center rounded-xl text-[#657060] transition-colors hover:bg-[#edf3e9]" aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}>{theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}</button>
            <button onClick={() => setShowHistory(true)} className="grid size-10 place-items-center rounded-xl text-[#657060] transition-colors hover:bg-[#edf3e9]" aria-label="Abrir historial"><History className="size-4" /></button>
            <button onClick={() => logout.mutate()} className="grid size-10 place-items-center rounded-xl text-[#657060] transition-colors hover:bg-[#fff0eb] hover:text-[#b55d45]" aria-label="Salir de la familia"><LogOut className="size-4" /></button>
          </div>
        </header>

        <section className="rise-in mt-4 overflow-hidden rounded-[2rem] bg-[#3f8765] px-5 py-6 text-[#fffdf8] soft-shadow sm:px-7 sm:py-8" style={{ animationDelay: "50ms" }}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[.12em] text-[#cde7d7] uppercase"><UsersRound className="size-3.5" /> La familia de</p>
              <h1 className="font-display text-4xl tracking-[-.045em] sm:text-5xl">{family.family.name}</h1>
              <p className="mt-2 text-sm text-[#dcefe4]">Hola, <span className="font-bold text-white">{family.memberName}</span>. La compra se hace mejor en compañía.</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/13 px-4 py-3 backdrop-blur-sm sm:min-w-64">
              <div><p className="text-[11px] font-bold tracking-[.1em] text-[#cde7d7] uppercase">Código familiar</p><p className="mt-0.5 font-mono text-lg font-bold tracking-[.15em] text-white">{family.family.inviteCode}</p></div>
              <button onClick={copyCode} className="grid size-10 place-items-center rounded-xl bg-white/16 text-white hover:bg-white/25" aria-label="Copiar código familiar"><Copy className="size-4" /></button>
            </div>
          </div>
        </section>

        <section className="rise-in mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]" style={{ animationDelay: "100ms" }}>
          <div className="min-w-0 space-y-5">
            <section className="theme-surface rounded-[1.75rem] border border-white/75 bg-[#fffdf8]/85 p-3 soft-shadow sm:p-4">
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div><h2 className="font-display text-xl tracking-[-.035em]">Mis listas</h2><p className="mt-0.5 text-xs text-muted-foreground">Elige dónde vas a comprar.</p></div>
                <Button variant="outline" onClick={() => setShowNewList(true)} className="h-10 rounded-xl border-[#cfe0d4] bg-[#f4fbf5] px-3 text-xs font-bold text-[#3f8765] hover:bg-[#e4f4e8]"><Plus className="size-4" /> Nueva</Button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
                {listsQuery.isLoading && <ListTabsSkeleton />}
                {listsQuery.data?.map(list => <div key={list.id} className={`relative shrink-0 rounded-2xl transition-all ${activeList === list.id ? "bg-[#3f8765] text-white lift-shadow" : "bg-[#f1f2eb] text-[#556052] hover:bg-[#e6ebdf]"}`}><button onClick={() => setActiveListId(list.id)} className="w-full px-4 py-3 pr-10 text-left"><p className="max-w-28 truncate text-sm font-bold">{list.name}</p><p className={`mt-0.5 text-[11px] ${activeList === list.id ? "text-[#d5eddf]" : "text-[#7b8376]"}`}>{list.createdBy === family.memberName ? "Tu lista" : `Por ${list.createdBy}`}</p></button><button onClick={() => setRemovingList({ id: list.id, name: list.name })} className={`absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg ${activeList === list.id ? "text-white/75 hover:bg-white/15 hover:text-white" : "text-[#7b8376] hover:bg-white/70 hover:text-[#b55d45]"}`} aria-label={`Eliminar la lista ${list.name}`}><Trash2 className="size-3" /></button></div>)}
              </div>
            </section>

            {activeList ? <>
              <section className="theme-surface rounded-[1.75rem] border border-white/75 bg-[#fffdf8]/85 p-4 soft-shadow sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-2xl tracking-[-.04em]">Añade algo a la lista</h2><p className="mt-1 text-xs text-muted-foreground">Con pocos datos, todos saben qué falta.</p></div><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f8dfae] text-[#8d642d]"><PackagePlus className="size-5" /></div></div>
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-[#e8f4ea] px-3 py-2 text-xs font-bold text-[#347653]"><ListPlus className="size-3.5" /> Añadiendo a: <span className="truncate">{activeListName}</span></div>
                <form onSubmit={submitNewItem} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_92px_150px_150px]">
                  <Input value={newItem.name} onChange={event => setNewItem({ ...newItem, name: event.target.value })} placeholder="Ej. Manzanas" aria-label="Nombre del artículo" className="h-12 rounded-xl border-[#e2dfd5] bg-white" />
                  <Input type="number" min="0.01" step="0.01" value={newItem.quantity} onChange={event => setNewItem({ ...newItem, quantity: event.target.value })} placeholder="Cant." aria-label="Cantidad" className="h-12 rounded-xl border-[#e2dfd5] bg-white" />
                  <select value={newItem.priority} onChange={event => setNewItem({ ...newItem, priority: event.target.value as ItemPriority })} aria-label="Prioridad" className="h-12 rounded-xl border border-[#e2dfd5] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35">{priorities.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  <Input type="date" value={newItem.deadline} onChange={event => setNewItem({ ...newItem, deadline: event.target.value })} aria-label="Fecha límite de compra" className="h-12 rounded-xl border-[#e2dfd5] bg-white" />
                  <Input value={newItem.tags} onChange={event => setNewItem({ ...newItem, tags: event.target.value })} placeholder="Etiquetas (opcional)" aria-label="Etiquetas separadas por comas" className="h-12 rounded-xl border-[#e2dfd5] bg-white" />
                  <Textarea value={newItem.note} onChange={event => setNewItem({ ...newItem, note: event.target.value })} placeholder="Comentario (opcional)" aria-label="Comentario sobre el artículo" className="min-h-12 rounded-xl border-[#e2dfd5] bg-white md:col-span-2" />
                  <Button type="submit" disabled={addItem.isPending} className="h-12 rounded-xl bg-[#3f8765] px-4 font-bold hover:bg-[#367653] xl:col-start-4" aria-label="Añadir artículo">{addItem.isPending ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-5" /> Añadir</>}</Button>
                </form>
              </section>

              <section className="theme-surface rounded-[1.75rem] border border-white/75 bg-[#fffdf8]/85 p-4 soft-shadow sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h2 className="font-display text-2xl tracking-[-.04em]">La lista</h2><span className="rounded-full bg-[#e7f2ea] px-2.5 py-1 text-xs font-bold text-[#3f8765]">{pendingCount} pendiente{pendingCount === 1 ? "" : "s"}</span></div><p className="mt-1 text-xs text-muted-foreground">Se actualiza automáticamente mientras compráis.</p></div>
                  <button onClick={() => setShowFilters(value => !value)} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors ${showFilters ? "bg-[#e7f2ea] text-[#327653]" : "bg-[#f1f2eb] text-[#667060] hover:bg-[#e7ebdf]"}`}><SlidersHorizontal className="size-4" /> Organizar <ChevronDown className={`size-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} /></button>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1"><StatusButton value="pending" current={status} onChange={setStatus} /><StatusButton value="completed" current={status} onChange={setStatus} /><StatusButton value="archived" current={status} onChange={setStatus} /><StatusButton value="all" current={status} onChange={setStatus} /></div>
                {showFilters && <div className="rise-in mt-4 grid gap-3 rounded-2xl bg-[#f7f5ee] p-3 sm:grid-cols-2 lg:grid-cols-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#7d857a]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar artículo o comentario" aria-label="Buscar artículo o comentario" className="h-11 rounded-xl border-transparent bg-white pl-9" /></div><select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as ItemPriority | "")} aria-label="Filtrar por prioridad" className="h-11 rounded-xl border border-transparent bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"><option value="">Todas las prioridades</option>{priorities.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select value={tag} onChange={event => setTag(event.target.value)} aria-label="Filtrar por etiqueta" className="h-11 rounded-xl border border-transparent bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35"><option value="">Todas las etiquetas</option>{allTags.map(option => <option key={option} value={option}>{option}</option>)}</select><div className="flex gap-2"><select value={sortBy} onChange={event => setSortBy(event.target.value as SortBy)} aria-label="Ordenar artículos" className="min-w-0 flex-1 h-11 rounded-xl border border-transparent bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/35">{sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button onClick={clearFilters} className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[#697264] hover:bg-[#ebeee6]" aria-label="Limpiar filtros"><X className="size-4" /></button></div></div>}
                {itemsQuery.error ? <QueryErrorPanel message="No pudimos actualizar los artículos de esta lista." onRetry={() => itemsQuery.refetch()} /> : <ItemList isLoading={itemsQuery.isLoading} entries={itemsQuery.data ?? []} onToggle={id => toggleItem.mutate({ itemId: id })} onEdit={item => setEditingItem(item)} onArchive={item => { setArchivingItem(item); setArchiveReason(""); }} onRestore={id => restoreItem.mutate({ itemId: id })} />}
              </section>
            </> : <EmptyLists onCreate={() => setShowNewList(true)} />}
          </div>

          <aside className="hidden xl:block"><ActivityPanel entries={activityQuery.data ?? []} isLoading={activityQuery.isLoading} error={activityQuery.error} onRetry={() => activityQuery.refetch()} compact /></aside>
        </section>
      </div>

      {showNewList && <Modal title="Nueva lista" description="Crea una lista para otra tienda, ocasión o semana." onClose={() => setShowNewList(false)}><form onSubmit={event => { event.preventDefault(); createList.mutate({ name: newListName }); }} className="space-y-4"><TextField label="Nombre de la lista" value={newListName} onChange={setNewListName} placeholder="Ej. Ferretería" autoFocus /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowNewList(false)} className="rounded-xl">Cancelar</Button><Button type="submit" disabled={createList.isPending || !newListName.trim()} className="rounded-xl bg-[#3f8765] hover:bg-[#367653]">{createList.isPending && <Loader2 className="size-4 animate-spin" />} Crear lista</Button></div></form></Modal>}
      {editingItem && <Modal title="Editar artículo" description="Actualiza lo que haga falta para la compra." onClose={() => setEditingItem(null)}><form onSubmit={event => { event.preventDefault(); updateItem.mutate({ itemId: editingItem.id, name: editingItem.name, quantity: Number(editingItem.quantity), priority: editingItem.priority, deadline: new Date(`${editingItem.deadline}T12:00:00`), note: editingItem.note, tags: editingItem.tags }); }} className="space-y-4"><TextField label="Nombre" value={editingItem.name} onChange={value => setEditingItem({ ...editingItem, name: value })} autoFocus /><div className="grid grid-cols-2 gap-3"><TextField label="Cantidad" type="number" value={editingItem.quantity} onChange={value => setEditingItem({ ...editingItem, quantity: value })} /><label className="grid gap-1.5 text-sm font-semibold text-[#4f594c]"><span>Prioridad</span><select value={editingItem.priority} onChange={event => setEditingItem({ ...editingItem, priority: event.target.value as ItemPriority })} className="h-11 rounded-xl border border-input bg-white px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/35">{priorities.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><label className="grid gap-1.5 text-sm font-semibold text-[#4f594c]"><span>Fecha límite</span><Input type="date" value={editingItem.deadline} onChange={event => setEditingItem({ ...editingItem, deadline: event.target.value })} className="h-11 rounded-xl bg-white font-normal" /></label><TextField label="Etiquetas" value={editingItem.tags.join(", ")} onChange={value => setEditingItem({ ...editingItem, tags: value.split(",").map(tagValue => tagValue.trim()).filter(Boolean) })} placeholder="Ej. desayuno, urgente" /><label className="grid gap-1.5 text-sm font-semibold text-[#4f594c]"><span>Comentario</span><Textarea value={editingItem.note} onChange={event => setEditingItem({ ...editingItem, note: event.target.value })} placeholder="Detalles para quien compre" className="min-h-24 rounded-xl bg-white font-normal" /></label><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditingItem(null)} className="rounded-xl">Cancelar</Button><Button type="submit" disabled={updateItem.isPending} className="rounded-xl bg-[#3f8765] hover:bg-[#367653]">{updateItem.isPending && <Loader2 className="size-4 animate-spin" />} Guardar cambios</Button></div></form></Modal>}
      {archivingItem && <Modal title="¿Quitar este artículo?" description={`“${archivingItem.name}” quedará en el historial y podrás restaurarlo después.`} onClose={() => setArchivingItem(null)}><form onSubmit={event => { event.preventDefault(); archiveItem.mutate({ itemId: archivingItem.id, reason: archiveReason }); }} className="space-y-4"><label className="grid gap-1.5 text-sm font-semibold text-[#4f594c]"><span>¿Por qué ya no se comprará?</span><Textarea value={archiveReason} onChange={event => setArchiveReason(event.target.value)} placeholder="Ej. Ya lo compramos en otro sitio" className="min-h-24 rounded-xl bg-white" autoFocus /></label><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setArchivingItem(null)} className="rounded-xl">Cancelar</Button><Button type="submit" disabled={archiveItem.isPending || archiveReason.trim().length < 3} className="rounded-xl bg-[#b95d47] text-white hover:bg-[#a94e39]">{archiveItem.isPending && <Loader2 className="size-4 animate-spin" />} Quitar artículo</Button></div></form></Modal>}
      {removingList && <Modal title="¿Eliminar esta lista?" description={`“${removingList.name}” dejará de aparecer en la familia. Sus artículos y el historial se conservarán internamente.`} onClose={() => setRemovingList(null)}><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setRemovingList(null)} className="rounded-xl">Cancelar</Button><Button type="button" disabled={removeList.isPending} onClick={() => removeList.mutate({ listId: removingList.id })} className="rounded-xl bg-[#b95d47] text-white hover:bg-[#a94e39]">{removeList.isPending && <Loader2 className="size-4 animate-spin" />} Eliminar lista</Button></div></Modal>}
      {showHistory && <MobilePanel onClose={() => setShowHistory(false)}><ActivityPanel entries={activityQuery.data ?? []} isLoading={activityQuery.isLoading} error={activityQuery.error} onRetry={() => activityQuery.refetch()} /></MobilePanel>}
    </main>
  );
}

function ItemList({ isLoading, entries, onToggle, onEdit, onArchive, onRestore }: { isLoading: boolean; entries: Array<{ item: { id: string; name: string; quantity: string; priority: ItemPriority; deadline: Date | null; note: string | null; tagsJson: string; status: "pending" | "completed" | "archived"; createdBy: string; completedBy: string | null; archiveReason: string | null }; listName: string }>; onToggle: (id: string) => void; onEdit: (item: { id: string; name: string; quantity: string; priority: ItemPriority; deadline: string; note: string; tags: string[] }) => void; onArchive: (item: { id: string; name: string }) => void; onRestore: (id: string) => void }) {
  if (isLoading) return <div className="mt-5 space-y-3"><ItemSkeleton /><ItemSkeleton /><ItemSkeleton /></div>;
  if (!entries.length) return <div className="mt-5 rounded-2xl border border-dashed border-[#d6ddd2] bg-[#f9faf6] px-5 py-12 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e6f1e8] text-[#4a8c68]"><ShoppingBasket className="size-5" /></div><h3 className="mt-4 font-display text-xl">Todo está en orden</h3><p className="mx-auto mt-1 max-w-64 text-sm leading-5 text-muted-foreground">No hay artículos que mostrar con estos filtros.</p></div>;
  return <div className="mt-5 space-y-3">{entries.map(({ item, listName }) => { const tags = parseTags(item.tagsJson); const isCompleted = item.status === "completed"; const isArchived = item.status === "archived"; const priority = priorityInfo(item.priority); return <article key={item.id} className={`group relative flex gap-3 rounded-2xl border p-3.5 transition-all sm:p-4 ${isArchived ? "border-[#ead8cf] bg-[#fdf5f1]" : isCompleted ? "border-[#dce8df] bg-[#f3f8f3]" : "border-[#ebe7da] bg-white hover:-translate-y-0.5 hover:shadow-md"}`}><button onClick={() => !isArchived && onToggle(item.id)} disabled={isArchived} className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${isCompleted ? "border-[#438866] bg-[#438866] text-white" : isArchived ? "border-[#d9bdb1] bg-transparent text-transparent" : "border-[#c8d5c9] bg-white text-transparent hover:border-[#438866]"}`} aria-label={isCompleted ? `Marcar ${item.name} como pendiente` : `Marcar ${item.name} como comprado`}><Check className="size-4 stroke-[3]" /></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className={`font-bold ${isCompleted || isArchived ? "text-[#738074] line-through" : "text-[#3e483d]"}`}>{item.name}</h3><span className="rounded-md bg-[#f2f3ed] px-1.5 py-0.5 text-xs font-bold text-[#5f695c]">{formatQuantity(item.quantity)}</span><span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${priorityClass(item.priority)}`}><Flag className="size-2.5" />{priority.label}</span></div><div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><CalendarDays className="size-3" />{deadlineText(item.deadline)}</span>{tags.map(currentTag => <span key={currentTag} className="inline-flex items-center gap-1 rounded-full bg-[#f0f4ef] px-2 py-0.5 text-[11px] font-semibold text-[#667564]"><Tags className="size-2.5" />{currentTag}</span>)}{entries.some(entry => entry.listName !== listName) && <span className="text-[11px] text-muted-foreground">{listName}</span>}</div>{item.note && <p className="mt-2 rounded-lg bg-[#f6f5ef] px-2.5 py-1.5 text-xs leading-5 text-[#5b6658]">{item.note}</p>}<p className="mt-2 text-[11px] text-muted-foreground">Añadido por {item.createdBy}{isCompleted && item.completedBy ? ` · Comprado por ${item.completedBy}` : ""}{isArchived && item.archiveReason ? ` · ${item.archiveReason}` : ""}</p></div><div className="flex shrink-0 gap-1 self-start">{isArchived ? <button onClick={() => onRestore(item.id)} className="grid size-8 place-items-center rounded-lg text-[#6d786a] hover:bg-white hover:text-[#3f8765]" aria-label={`Restaurar ${item.name}`}><RotateCcw className="size-4" /></button> : <><button onClick={() => onEdit({ id: item.id, name: item.name, quantity: item.quantity, priority: item.priority, deadline: dateInputValue(item.deadline), note: item.note ?? "", tags })} className="grid size-8 place-items-center rounded-lg text-[#788175] hover:bg-[#edf2ea] hover:text-[#3f8765]" aria-label={`Editar ${item.name}`}><Pencil className="size-3.5" /></button><button onClick={() => onArchive({ id: item.id, name: item.name })} className="grid size-8 place-items-center rounded-lg text-[#788175] hover:bg-[#fff0eb] hover:text-[#b55d45]" aria-label={`Quitar ${item.name}`}><Trash2 className="size-3.5" /></button></>}</div></article>; })}</div>;
}

function ActivityPanel({ entries, isLoading, error, onRetry, compact = false }: { entries: Array<{ id: string; action: string; actorName: string; description: string; createdAt: Date }>; isLoading: boolean; error: unknown; onRetry: () => void; compact?: boolean }) {
  return <section className={`theme-surface rounded-[1.75rem] border border-white/75 bg-[#fffdf8]/85 p-4 soft-shadow ${compact ? "sticky top-24" : ""}`}><div className="flex items-center justify-between"><div><h2 className="font-display text-xl tracking-[-.035em]">Lo último</h2><p className="mt-0.5 text-xs text-muted-foreground">Pequeños pasos de la familia.</p></div><div className="grid size-10 place-items-center rounded-xl bg-[#f7e5bc] text-[#8c6632]"><History className="size-4" /></div></div><div className="mt-5 space-y-4">{error ? <QueryErrorPanel message="No pudimos cargar el historial." onRetry={onRetry} compact /> : isLoading ? <><ActivitySkeleton /><ActivitySkeleton /><ActivitySkeleton /></> : entries.length ? entries.map(entry => <div key={entry.id} className="flex gap-3"><div className="mt-1.5 size-2 shrink-0 rounded-full bg-[#67a782]" /><div><p className="text-sm leading-5 text-[#4e594c]"><span className="font-bold">{entry.actorName}</span> {entry.description}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div></div>) : <p className="rounded-xl bg-[#f7f6ef] px-3 py-5 text-center text-sm text-muted-foreground">Aún no hay actividad.</p>}</div></section>;
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) { return <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center bg-[#29352f]/35 p-3 backdrop-blur-[2px] sm:items-center"><section className="theme-surface rise-in w-full max-w-md rounded-[1.75rem] bg-[#fffdf8] p-5 soft-shadow sm:p-6"><div className="mb-5 flex gap-3"><div className="min-w-0 flex-1"><h2 className="font-display text-2xl tracking-[-.04em]">{title}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p></div><button onClick={onClose} className="theme-icon-control grid size-9 shrink-0 place-items-center rounded-xl bg-[#f2f2eb] text-[#6e776a] hover:bg-[#e7e9e1]" aria-label="Cerrar"><X className="size-4" /></button></div>{children}</section></div>; }
function MobilePanel({ onClose, children }: { onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 bg-[#29352f]/35 p-3 backdrop-blur-[2px] xl:hidden"><div className="theme-surface rise-in ml-auto flex h-full max-w-md flex-col overflow-auto rounded-[1.75rem] bg-[#f7f4ee] p-2 soft-shadow"><div className="flex justify-end p-2"><button onClick={onClose} className="theme-icon-control grid size-10 place-items-center rounded-xl bg-white text-[#667060]" aria-label="Cerrar historial"><X className="size-4" /></button></div>{children}</div></div>; }
function Brand({ compact = false }: { compact?: boolean }) { return <div className="flex items-center gap-2.5"><div className={`grid place-items-center rounded-[1rem] bg-[#e1f0e5] text-[#3f8765] ${compact ? "size-9" : "size-11"}`}><ShoppingBasket className={compact ? "size-5" : "size-6"} /></div><div><p className={`font-display font-bold leading-none tracking-[-.04em] text-[#3d463a] ${compact ? "text-lg" : "text-xl"}`}>Lista Familiar</p>{!compact && <p className="mt-1 text-[11px] font-semibold tracking-[.08em] text-[#7e897a] uppercase">compramos juntos</p>}</div></div>; }
function ChooseAccess({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return <div><div className="mb-7"><p className="mb-2 text-xs font-bold tracking-[.1em] text-[#548061] uppercase">Bienvenidos</p><h2 className="font-display text-3xl tracking-[-.045em] text-[#3f483b]">¿Empezamos?</h2><p className="mt-2 text-sm leading-5 text-muted-foreground">Crea un nuevo espacio o vuelve a una lista que ya compartes.</p></div><div className="space-y-3"><button onClick={onCreate} className="theme-access-card theme-access-create group flex w-full items-center gap-4 rounded-2xl border border-[#d9e8da] bg-[#f3faf4] p-4 text-left transition-colors hover:bg-[#e7f4e9]"><div className="grid size-11 place-items-center rounded-xl bg-[#ccebd5] text-[#3f8765]"><Plus className="size-5" /></div><div className="min-w-0 flex-1"><p className="font-bold text-[#3f4d40]">Crear una familia</p><p className="mt-0.5 text-xs text-[#6b796d]">Tendrás un código para compartir.</p></div><ChevronDown className="size-4 -rotate-90 text-[#6d9275] transition-transform group-hover:translate-x-0.5" /></button><button onClick={onJoin} className="theme-access-card theme-access-join group flex w-full items-center gap-4 rounded-2xl border border-[#eee4d4] bg-[#fffaf0] p-4 text-left transition-colors hover:bg-[#fff4df]"><div className="grid size-11 place-items-center rounded-xl bg-[#f6dfae] text-[#946b31]"><UsersRound className="size-5" /></div><div className="min-w-0 flex-1"><p className="font-bold text-[#4f4b40]">Entrar con un código</p><p className="mt-0.5 text-xs text-[#827867]">Ya formas parte de una familia.</p></div><ChevronDown className="size-4 -rotate-90 text-[#a88751] transition-transform group-hover:translate-x-0.5" /></button></div></div>;
}
function FormHeading({ kicker, title, onBack }: { kicker: string; title: string; onBack: () => void }) { return <div className="flex gap-3"><div className="min-w-0 flex-1"><p className="mb-1 text-xs font-bold tracking-[.1em] text-[#548061] uppercase">{kicker}</p><h2 className="font-display text-3xl tracking-[-.045em] text-[#3f483b]">{title}</h2></div><button type="button" onClick={onBack} className="grid size-9 place-items-center rounded-xl bg-[#f0f2eb] text-[#6d7569] hover:bg-[#e5e9e0]" aria-label="Volver"><X className="size-4" /></button></div>; }
function TextField({ label, value, onChange, placeholder = "", type = "text", autoFocus = false, className = "", compact = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; autoFocus?: boolean; className?: string; compact?: boolean }) { return <label className={`grid gap-1.5 text-sm font-semibold text-[#4f594c] ${compact ? "text-xs" : ""}`}><span>{label}</span><Input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoFocus={autoFocus} className={`h-11 rounded-xl border-[#e3e0d6] bg-white font-normal placeholder:text-[#a6aaa1] ${className}`} /></label>; }
function FormError({ message }: { message: string }) { return <p role="alert" className="rounded-xl bg-[#fff0eb] px-3 py-2.5 text-sm font-medium text-[#a74b37]">{message}</p>; }
function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex items-center justify-center gap-1.5 rounded-xl bg-white/60 px-2 py-2.5 shadow-sm"><span className="text-[#548061]">{icon}</span>{text}</div>; }
function StatusButton({ value, current, onChange }: { value: ViewStatus; current: ViewStatus; onChange: (value: ViewStatus) => void }) { return <button onClick={() => onChange(value)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${current === value ? "bg-[#3f8765] text-white" : "bg-[#f1f2eb] text-[#667060] hover:bg-[#e6ebdf]"}`}>{statusLabels[value]}</button>; }
function ListTabsSkeleton() { return <><div className="h-16 w-28 shrink-0 animate-pulse rounded-2xl bg-[#edf0e8]" /><div className="h-16 w-28 shrink-0 animate-pulse rounded-2xl bg-[#edf0e8]" /></>; }
function ItemSkeleton() { return <div className="h-24 animate-pulse rounded-2xl bg-[#f2f3ed]" />; }
function ActivitySkeleton() { return <div className="h-10 animate-pulse rounded-xl bg-[#f2f3ed]" />; }
function EmptyLists({ onCreate }: { onCreate: () => void }) { return <section className="rounded-[1.75rem] border border-dashed border-[#c9d8cb] bg-[#f5faf5] p-10 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#dceee1] text-[#438866]"><ListPlus className="size-6" /></div><h2 className="mt-4 font-display text-2xl">Tu primera lista está esperando</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-5 text-muted-foreground">Crea una para reunir esas pequeñas cosas que no quieres olvidar.</p><Button onClick={onCreate} className="mt-5 rounded-xl bg-[#3f8765] hover:bg-[#367653]"><Plus className="size-4" /> Crear una lista</Button></section>; }
function QueryErrorPanel({ message, onRetry, compact = false }: { message: string; onRetry: () => void; compact?: boolean }) { return <div role="alert" className={`mt-4 rounded-2xl border border-[#efd7ce] bg-[#fff6f2] text-center ${compact ? "p-4" : "p-7"}`}><p className="text-sm font-semibold text-[#944c3c]">{message}</p><Button variant="outline" onClick={onRetry} className="mt-3 h-9 rounded-xl border-[#e8c6ba] bg-white text-xs font-bold text-[#9d513f] hover:bg-[#fff0ea]"><RotateCcw className="size-3.5" /> Reintentar</Button></div>; }
function ConnectionError({ title, description, onRetry }: { title: string; description: string; onRetry: () => void }) { return <main className="flex min-h-screen items-center justify-center px-5"><section role="alert" className="paper-grain rise-in max-w-sm rounded-[2rem] border border-white/80 bg-[#fffdf8] p-7 text-center soft-shadow"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0eb] text-[#ae5945]"><Filter className="size-6" /></div><h1 className="mt-5 font-display text-3xl tracking-[-.045em]">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><Button onClick={onRetry} className="mt-5 rounded-xl bg-[#3f8765] hover:bg-[#367653]"><RotateCcw className="size-4" /> Reintentar</Button></section></main>; }
