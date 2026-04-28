import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = "menu" | "game" | "inventory" | "shop" | "upgrade";

interface Plant {
  id: string;
  name: string;
  emoji: string;
  rarity: "common" | "rare" | "legendary";
  xp: number;
  gold: number;
  desc: string;
  sellPrice: number;
}

interface Seed {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  plant: string;
  rarity: "common" | "rare" | "legendary";
}

interface PlayerStats {
  level: number;
  xp: number;
  xpNeeded: number;
  gold: number;
  hp: number;
  maxHp: number;
  luck: number;
  speed: number;
  bag: number;
  maxBag: number;
}

interface InventoryItem {
  plant: Plant;
  count: number;
}

interface Notification {
  id: number;
  text: string;
  type: "success" | "gold" | "legendary" | "info";
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PLANTS: Plant[] = [
  { id: "mushroom", name: "Мухомор", emoji: "🍄", rarity: "common", xp: 5, gold: 8, desc: "Ядовитый, но ценный", sellPrice: 8 },
  { id: "blueberry", name: "Черника", emoji: "🫐", rarity: "common", xp: 4, gold: 6, desc: "Лесные ягоды", sellPrice: 6 },
  { id: "fern", name: "Папоротник", emoji: "🌿", rarity: "common", xp: 3, gold: 5, desc: "Древнее растение", sellPrice: 5 },
  { id: "herb", name: "Целебная трава", emoji: "🌱", rarity: "common", xp: 6, gold: 10, desc: "Лечит хворь", sellPrice: 10 },
  { id: "violet", name: "Лесная фиалка", emoji: "💜", rarity: "rare", xp: 15, gold: 25, desc: "Редкий цветок", sellPrice: 25 },
  { id: "glow_moss", name: "Светомох", emoji: "✨", rarity: "rare", xp: 18, gold: 30, desc: "Светится ночью", sellPrice: 30 },
  { id: "mandrake", name: "Мандрагора", emoji: "🌺", rarity: "legendary", xp: 50, gold: 120, desc: "Легендарный корень", sellPrice: 120 },
  { id: "moonflower", name: "Лунный цветок", emoji: "🌸", rarity: "legendary", xp: 60, gold: 150, desc: "Цветёт раз в луну", sellPrice: 150 },
];

const SEEDS: Seed[] = [
  { id: "s_fern", name: "Семя папоротника", emoji: "🌿", cost: 15, plant: "fern", rarity: "common" },
  { id: "s_herb", name: "Семя травы", emoji: "🌱", cost: 20, plant: "herb", rarity: "common" },
  { id: "s_violet", name: "Семя фиалки", emoji: "💜", cost: 60, plant: "violet", rarity: "rare" },
  { id: "s_glow", name: "Семя светомха", emoji: "✨", cost: 80, plant: "glow_moss", rarity: "rare" },
  { id: "s_mandrake", name: "Семя мандрагоры", emoji: "🌺", cost: 200, plant: "mandrake", rarity: "legendary" },
];

const UPGRADES = [
  { id: "luck", name: "Удача", desc: "Больше редких находок", emoji: "🍀", stat: "luck", costs: [50, 120, 250, 500], effect: "+10% шанс редкости" },
  { id: "speed", name: "Скорость", desc: "Быстрее перемещение", emoji: "⚡", stat: "speed", costs: [40, 100, 200, 400], effect: "+1 действие/ход" },
  { id: "bag", name: "Рюкзак", desc: "Больше места для трав", emoji: "🎒", stat: "bag", costs: [30, 80, 160, 320], effect: "+5 слотов" },
  { id: "hp", name: "Здоровье", desc: "Выносливость в лесу", emoji: "❤️", stat: "hp", costs: [35, 90, 180, 360], effect: "+20 HP" },
];

// ─── Forest cells data ───────────────────────────────────────────────────────

const CELL_TYPES = [
  { type: "grass", emoji: "🌲", label: "" },
  { type: "bush", emoji: "🌳", label: "" },
  { type: "rock", emoji: "🪨", label: "" },
  { type: "flower", emoji: "🌼", label: "" },
  { type: "empty", emoji: "·", label: "" },
];

function randomCell() {
  const r = Math.random();
  if (r < 0.35) return "🌲";
  if (r < 0.55) return "🌳";
  if (r < 0.65) return "🪨";
  if (r < 0.75) return "🌼";
  return "·";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Index() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [player, setPlayer] = useState<PlayerStats>({
    level: 1, xp: 0, xpNeeded: 100,
    gold: 80, hp: 100, maxHp: 100,
    luck: 1, speed: 1, bag: 3, maxBag: 20,
  });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [seeds, setSeeds] = useState<{ seed: Seed; count: number }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [forestGrid] = useState(() => Array.from({ length: 24 }, randomCell));
  const [collectingCell, setCollectingCell] = useState<number | null>(null);
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({ luck: 0, speed: 0, bag: 0, hp: 0 });
  const [shopTab, setShopTab] = useState<"sell" | "buy">("sell");
  const [invTab, setInvTab] = useState<"plants" | "seeds">("plants");
  const [saveVisible, setSaveVisible] = useState(false);

  const notify = useCallback((text: string, type: Notification["type"] = "success") => {
    const id = Date.now();
    setNotifications(prev => [...prev.slice(-3), { id, text, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 3000);
  }, []);

  const addXp = useCallback((amount: number, stats: PlayerStats): PlayerStats => {
    let { xp, xpNeeded, level } = stats;
    xp += amount;
    while (xp >= xpNeeded) {
      xp -= xpNeeded;
      level += 1;
      xpNeeded = Math.floor(xpNeeded * 1.4);
      notify(`🎉 Уровень ${level}! Поздравляю!`, "info");
    }
    return { ...stats, xp, xpNeeded, level };
  }, [notify]);

  const collectPlant = (cellIdx: number) => {
    if (collectingCell !== null) return;
    const totalInv = inventory.reduce((s, i) => s + i.count, 0);
    if (totalInv >= player.maxBag) { notify("🎒 Рюкзак полон!", "info"); return; }

    setCollectingCell(cellIdx);
    setTimeout(() => {
      setCollectingCell(null);
      // Determine rarity based on luck
      const luckBonus = player.luck * 0.05;
      const roll = Math.random();
      let pool: Plant[];
      if (roll < 0.03 + luckBonus * 0.5) {
        pool = PLANTS.filter(p => p.rarity === "legendary");
        notify(`✨ ЛЕГЕНДАРНОЕ растение: ${pool[0].name}!`, "legendary");
      } else if (roll < 0.20 + luckBonus) {
        pool = PLANTS.filter(p => p.rarity === "rare");
        notify(`💜 Редкое: ${pool[Math.floor(Math.random() * pool.length)].name}!`, "gold");
      } else {
        pool = PLANTS.filter(p => p.rarity === "common");
        notify(`🌿 Собрано: ${pool[Math.floor(Math.random() * pool.length)].name}`, "success");
      }
      const found = pool[Math.floor(Math.random() * pool.length)];
      setInventory(prev => {
        const existing = prev.find(i => i.plant.id === found.id);
        if (existing) return prev.map(i => i.plant.id === found.id ? { ...i, count: i.count + 1 } : i);
        return [...prev, { plant: found, count: 1 }];
      });
      setPlayer(prev => addXp(found.xp, prev));
    }, 600);
  };

  const sellPlant = (item: InventoryItem) => {
    const earned = item.plant.sellPrice * item.count;
    setInventory(prev => prev.filter(i => i.plant.id !== item.plant.id));
    setPlayer(prev => ({ ...prev, gold: prev.gold + earned }));
    notify(`💰 Продано за ${earned} 🪙`, "gold");
  };

  const buySeed = (seed: Seed) => {
    if (player.gold < seed.cost) { notify("💸 Недостаточно золота!", "info"); return; }
    setPlayer(prev => ({ ...prev, gold: prev.gold - seed.cost }));
    setSeeds(prev => {
      const ex = prev.find(s => s.seed.id === seed.id);
      if (ex) return prev.map(s => s.seed.id === seed.id ? { ...s, count: s.count + 1 } : s);
      return [...prev, { seed, count: 1 }];
    });
    notify(`🌱 Куплено: ${seed.name}`, "success");
  };

  const applyUpgrade = (upg: typeof UPGRADES[0]) => {
    const currentLvl = upgradeLevels[upg.id] || 0;
    if (currentLvl >= upg.costs.length) { notify("Максимальный уровень!", "info"); return; }
    const cost = upg.costs[currentLvl];
    if (player.gold < cost) { notify("💸 Недостаточно золота!", "info"); return; }
    setPlayer(prev => {
      const next = { ...prev, gold: prev.gold - cost };
      if (upg.stat === "luck") next.luck = prev.luck + 1;
      if (upg.stat === "speed") next.speed = prev.speed + 1;
      if (upg.stat === "bag") { next.maxBag = prev.maxBag + 5; }
      if (upg.stat === "hp") { next.maxHp = prev.maxHp + 20; next.hp = Math.min(prev.hp + 20, next.maxHp); }
      return next;
    });
    setUpgradeLevels(prev => ({ ...prev, [upg.id]: currentLvl + 1 }));
    notify(`⬆️ ${upg.name} улучшена!`, "success");
  };

  const handleSave = () => {
    setSaveVisible(true);
    setTimeout(() => setSaveVisible(false), 2000);
    notify("💾 Игра сохранена", "info");
  };

  // ── Menu Screen ────────────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <div className="min-h-screen forest-bg flex flex-col items-center justify-center relative overflow-hidden">
        {/* Fireflies */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-green-300"
            style={{ left: `${10 + i * 12}%`, top: `${20 + (i % 3) * 25}%`, animationDelay: `${i * 0.4}s`, animation: `firefly ${2 + i * 0.3}s ease-in-out infinite` }} />
        ))}

        {/* Background image */}
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "url(https://cdn.poehali.dev/projects/54e2691f-8374-4320-a622-72eb51eb4667/files/55e87b81-b2b8-46c5-86e3-af8be54d887f.jpg)", backgroundSize: "cover", backgroundPosition: "center" }} />

        <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in">
          {/* Title */}
          <div className="text-center">
            <div className="font-pixel text-green-400 text-xs mb-3 tracking-widest opacity-70">✦ PixelForest RPG ✦</div>
            <h1 className="font-pixel text-green-300 leading-relaxed" style={{ fontSize: "clamp(14px, 3vw, 22px)", textShadow: "0 0 20px rgba(74,222,128,0.6), 3px 3px 0 #000" }}>
              ЛЕСНАЯ<br />ТРАВНИЦА
            </h1>
            <div className="font-pixel text-yellow-400 text-xs mt-3" style={{ textShadow: "0 0 10px rgba(251,191,36,0.5)" }}>
              ⚔ Собирай · Торгуй · Прокачивайся ⚔
            </div>
          </div>

          {/* Character */}
          <div className="animate-float text-8xl" style={{ filter: "drop-shadow(0 0 20px rgba(74,222,128,0.4))" }}>
            🧙‍♀️
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-4 w-64">
            <button className="pixel-btn pixel-btn-green py-4 px-6 text-center" onClick={() => setScreen("game")}>
              ▶ НАЧАТЬ ИГРУ
            </button>
            <button className="pixel-btn pixel-btn-purple py-3 px-6 text-center" onClick={() => setScreen("game")}>
              📂 ЗАГРУЗИТЬ
            </button>
            <button className="pixel-btn pixel-btn-gold py-3 px-6 text-center opacity-70 cursor-not-allowed">
              ⚙ НАСТРОЙКИ
            </button>
          </div>

          {/* Stars decoration */}
          <div className="font-pixel text-yellow-500 text-xs opacity-50 animate-sparkle">
            ★ ★ ★ ★ ★
          </div>
        </div>
      </div>
    );
  }

  // ── Shared layout (game/inventory/shop/upgrade) ────────────────────────────
  const totalInv = inventory.reduce((s, i) => s + i.count, 0);

  return (
    <div className="h-screen forest-bg flex flex-col overflow-hidden animate-screen-enter">

      {/* TOP BAR */}
      <div className="pixel-box bg-[#0d1a0d] px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button className="pixel-btn pixel-btn-green px-2 py-1 text-xs" onClick={() => setScreen("menu")}>◀</button>
          <div>
            <div className="font-pixel text-green-400 text-xs">Ур.{player.level} Травница</div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="stat-bar w-20">
                <div className="stat-bar-fill bg-green-500" style={{ width: `${(player.xp / player.xpNeeded) * 100}%` }} />
              </div>
              <span className="font-pixel text-green-600 text-xs">{player.xp}/{player.xpNeeded}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="font-pixel text-red-400 text-xs flex items-center gap-1">
            ❤️ {player.hp}/{player.maxHp}
          </div>
          <div className="font-pixel text-yellow-400 text-xs flex items-center gap-1">
            🪙 {player.gold}
          </div>
          <button className="pixel-btn pixel-btn-gold px-2 py-1 text-xs" onClick={handleSave}>
            {saveVisible ? "✓" : "💾"}
          </button>
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* ── GAME SCREEN ── */}
        {screen === "game" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 font-pixel text-green-500 text-xs opacity-70 flex-shrink-0">
              🌲 ТЁМНЫЙ ЛЕС · Нажми на клетку чтобы собрать растение
            </div>
            <div className="flex-1 overflow-auto px-2 pb-2">
              <div className="grid grid-cols-6 gap-1" style={{ minHeight: "280px" }}>
                {forestGrid.map((cell, i) => (
                  <button key={i}
                    className={`game-cell pixel-box aspect-square flex items-center justify-center text-2xl relative
                      ${collectingCell === i ? "bg-green-900/60 border-green-400" : ""}`}
                    style={{ minHeight: "52px", fontSize: "26px" }}
                    onClick={() => collectPlant(i)}
                  >
                    {collectingCell === i
                      ? <span className="animate-sparkle">⭐</span>
                      : cell === "·"
                      ? <span className="text-green-900 font-pixel text-xs">·</span>
                      : cell}
                  </button>
                ))}
              </div>
            </div>
            {/* Bag info */}
            <div className="px-3 py-1.5 flex-shrink-0 pixel-box bg-[#0d1a0d]">
              <div className="flex items-center gap-2">
                <span className="font-pixel text-xs text-green-600">🎒 Рюкзак:</span>
                <div className="stat-bar flex-1">
                  <div className="stat-bar-fill bg-green-700" style={{ width: `${(totalInv / player.maxBag) * 100}%` }} />
                </div>
                <span className="font-pixel text-xs text-green-500">{totalInv}/{player.maxBag}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── INVENTORY SCREEN ── */}
        {screen === "inventory" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-2 flex gap-2 flex-shrink-0">
              <button className={`font-pixel text-xs px-3 py-1.5 pixel-btn ${invTab === "plants" ? "pixel-btn-green" : "pixel-btn-red"}`}
                onClick={() => setInvTab("plants")}>🌿 ТРАВЫ ({totalInv})</button>
              <button className={`font-pixel text-xs px-3 py-1.5 pixel-btn ${invTab === "seeds" ? "pixel-btn-green" : "pixel-btn-red"}`}
                onClick={() => setInvTab("seeds")}>🌱 СЕМЕНА ({seeds.reduce((s, x) => s + x.count, 0)})</button>
            </div>
            <div className="flex-1 overflow-auto px-3 py-2">
              {invTab === "plants" && (
                <div className="flex flex-col gap-2">
                  {inventory.length === 0 && (
                    <div className="font-pixel text-green-800 text-xs text-center py-12">
                      Рюкзак пуст...<br /><br />Иди в лес! 🌲
                    </div>
                  )}
                  {inventory.map(item => (
                    <div key={item.plant.id}
                      className={`pixel-box p-3 flex items-center gap-3 ${item.plant.rarity === "legendary" ? "pixel-box-legendary" : item.plant.rarity === "rare" ? "pixel-box-gold" : ""}`}>
                      <span className="text-3xl">{item.plant.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-xs text-green-300">{item.plant.name}</span>
                          {item.plant.rarity === "legendary" && <span className="font-pixel text-xs text-yellow-400 animate-sparkle">★ЛЕГЕНДА</span>}
                          {item.plant.rarity === "rare" && <span className="font-pixel text-xs text-purple-400">◆ РЕД.</span>}
                        </div>
                        <div className="font-pixel text-xs text-green-700 mt-0.5">{item.plant.desc}</div>
                        <div className="flex gap-3 mt-1">
                          <span className="font-pixel text-xs text-yellow-500">🪙{item.plant.sellPrice}ea</span>
                          <span className="font-pixel text-xs text-green-600">x{item.count}</span>
                          <span className="font-pixel text-xs text-yellow-400">= {item.plant.sellPrice * item.count}🪙</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {invTab === "seeds" && (
                <div className="flex flex-col gap-2">
                  {seeds.length === 0 && (
                    <div className="font-pixel text-green-800 text-xs text-center py-12">
                      Нет семян...<br /><br />Купи в магазине! 🛒
                    </div>
                  )}
                  {seeds.map(({ seed, count }) => (
                    <div key={seed.id} className={`pixel-box p-3 flex items-center gap-3 ${seed.rarity === "legendary" ? "pixel-box-legendary" : seed.rarity === "rare" ? "pixel-box-gold" : ""}`}>
                      <span className="text-3xl">{seed.emoji}</span>
                      <div className="flex-1">
                        <div className="font-pixel text-xs text-green-300">{seed.name}</div>
                        <div className="font-pixel text-xs text-green-700 mt-0.5">Редкость: {seed.rarity === "legendary" ? "★ Легенда" : seed.rarity === "rare" ? "◆ Редкое" : "Обычное"}</div>
                      </div>
                      <div className="font-pixel text-xs text-green-400">x{count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SHOP SCREEN ── */}
        {screen === "shop" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-2 flex gap-2 flex-shrink-0">
              <button className={`font-pixel text-xs px-3 py-1.5 pixel-btn ${shopTab === "sell" ? "pixel-btn-gold" : "pixel-btn-red"}`}
                onClick={() => setShopTab("sell")}>💰 ПРОДАТЬ</button>
              <button className={`font-pixel text-xs px-3 py-1.5 pixel-btn ${shopTab === "buy" ? "pixel-btn-gold" : "pixel-btn-red"}`}
                onClick={() => setShopTab("buy")}>🛒 КУПИТЬ</button>
            </div>
            <div className="px-3 py-1 font-pixel text-yellow-500 text-xs flex-shrink-0">
              🪙 Ваш баланс: {player.gold} золота
            </div>
            <div className="flex-1 overflow-auto px-3 pb-3">
              {shopTab === "sell" && (
                <div className="flex flex-col gap-2">
                  {inventory.length === 0 && (
                    <div className="font-pixel text-green-800 text-xs text-center py-12">
                      Нет трав для продажи...<br /><br />Иди собирать! 🌲
                    </div>
                  )}
                  {inventory.map(item => (
                    <div key={item.plant.id} className={`pixel-box p-3 flex items-center gap-3 ${item.plant.rarity === "legendary" ? "pixel-box-legendary" : item.plant.rarity === "rare" ? "pixel-box-gold" : ""}`}>
                      <span className="text-3xl">{item.plant.emoji}</span>
                      <div className="flex-1">
                        <div className="font-pixel text-xs text-green-300">{item.plant.name}</div>
                        <div className="font-pixel text-xs text-yellow-400 mt-0.5">x{item.count} · Итого: {item.plant.sellPrice * item.count} 🪙</div>
                      </div>
                      <button className="pixel-btn pixel-btn-gold px-3 py-2 text-xs" onClick={() => sellPlant(item)}>
                        ПРОДАТЬ
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {shopTab === "buy" && (
                <div className="flex flex-col gap-2">
                  <div className="font-pixel text-green-700 text-xs py-1">Магазин семян:</div>
                  {SEEDS.map(seed => (
                    <div key={seed.id} className={`pixel-box p-3 flex items-center gap-3 ${seed.rarity === "legendary" ? "pixel-box-legendary" : seed.rarity === "rare" ? "pixel-box-gold" : ""}`}>
                      <span className="text-3xl">{seed.emoji}</span>
                      <div className="flex-1">
                        <div className="font-pixel text-xs text-green-300">{seed.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-pixel text-xs text-yellow-400">💰 {seed.cost} 🪙</span>
                          {seed.rarity === "legendary" && <span className="font-pixel text-xs text-yellow-400 animate-sparkle">★</span>}
                          {seed.rarity === "rare" && <span className="font-pixel text-xs text-purple-400">◆</span>}
                        </div>
                      </div>
                      <button
                        className={`pixel-btn px-3 py-2 text-xs ${player.gold >= seed.cost ? "pixel-btn-green" : "pixel-btn-red opacity-50"}`}
                        onClick={() => buySeed(seed)}
                        disabled={player.gold < seed.cost}
                      >
                        КУПИТЬ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── UPGRADE SCREEN ── */}
        {screen === "upgrade" && (
          <div className="flex-1 overflow-auto px-3 py-2">
            <div className="font-pixel text-green-500 text-xs mb-3 opacity-70">⚔ ПРОКАЧКА ПЕРСОНАЖА</div>
            <div className="grid grid-cols-1 gap-3">
              {UPGRADES.map(upg => {
                const lvl = upgradeLevels[upg.id] || 0;
                const maxed = lvl >= upg.costs.length;
                const cost = maxed ? 0 : upg.costs[lvl];
                const canAfford = player.gold >= cost;
                return (
                  <div key={upg.id} className="pixel-box p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{upg.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-xs text-green-300">{upg.name}</span>
                          <span className="font-pixel text-xs text-yellow-400">Ур.{lvl}/{upg.costs.length}</span>
                        </div>
                        <div className="font-pixel text-xs text-green-700 mt-0.5">{upg.desc}</div>
                        <div className="font-pixel text-xs text-purple-400 mt-0.5">{upg.effect}</div>
                        {/* Level bar */}
                        <div className="stat-bar mt-2 w-full">
                          <div className="stat-bar-fill bg-purple-600" style={{ width: `${(lvl / upg.costs.length) * 100}%` }} />
                        </div>
                      </div>
                      <button
                        className={`pixel-btn px-3 py-2 text-xs ${maxed ? "pixel-btn-red opacity-40" : canAfford ? "pixel-btn-purple" : "pixel-btn-red opacity-50"}`}
                        onClick={() => applyUpgrade(upg)}
                        disabled={maxed || !canAfford}
                      >
                        {maxed ? "МАКС" : `${cost}🪙`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Stats summary */}
            <div className="pixel-box p-3 mt-3 bg-[#0d1a0d]">
              <div className="font-pixel text-green-500 text-xs mb-2">📊 ХАРАКТЕРИСТИКИ</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Удача", val: player.luck, icon: "🍀" },
                  { label: "Скорость", val: player.speed, icon: "⚡" },
                  { label: "Рюкзак", val: player.maxBag, icon: "🎒" },
                  { label: "Здоровье", val: player.maxHp, icon: "❤️" },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-sm">{s.icon}</span>
                    <span className="font-pixel text-xs text-green-600">{s.label}:</span>
                    <span className="font-pixel text-xs text-green-300">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div className="pixel-box bg-[#0d1a0d] flex flex-shrink-0">
        {([
          { id: "game", label: "ЛЕС", emoji: "🌲" },
          { id: "inventory", label: "СУМКА", emoji: "🎒" },
          { id: "shop", label: "ТОРГОВЛЯ", emoji: "🛒" },
          { id: "upgrade", label: "ПРОКАЧКА", emoji: "⚔️" },
        ] as { id: Screen; label: string; emoji: string }[]).map(tab => (
          <button key={tab.id}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors
              ${screen === tab.id ? "bg-green-900/40 border-t-2 border-green-400" : "border-t-2 border-transparent hover:bg-green-900/20"}`}
            onClick={() => setScreen(tab.id)}
          >
            <span className="text-xl">{tab.emoji}</span>
            <span className={`font-pixel text-xs ${screen === tab.id ? "text-green-300" : "text-green-700"}`}
              style={{ fontSize: "7px" }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* NOTIFICATIONS */}
      <div className="fixed top-16 right-3 flex flex-col gap-2 z-50 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`notification pixel-box px-3 py-2 font-pixel text-xs max-w-xs
            ${n.type === "legendary" ? "bg-yellow-950 border-yellow-400 text-yellow-300" :
              n.type === "gold" ? "bg-yellow-950/80 border-yellow-600 text-yellow-400" :
              n.type === "info" ? "bg-blue-950/80 border-blue-500 text-blue-300" :
              "bg-green-950/80 border-green-500 text-green-300"}`}>
            {n.text}
          </div>
        ))}
      </div>
    </div>
  );
}
