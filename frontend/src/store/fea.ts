import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FEAModel, FEAResult, ElementGroup, GroupStats, GroupCategory } from '../types';
import {
  solve as feaSolve,
  presetCantileverBeam,
  presetBridgeTruss,
  presetSimpleFrame,
  jetColormap,
} from '../utils/fea-solver';

export const useFEAStore = defineStore('fea', () => {
  const model = ref<FEAModel>({ nodes: [], elements: [], loads: [] });
  const result = ref<FEAResult | null>(null);
  const selectedPreset = ref<string>('cantilever');
  const showDeformed = ref(false);
  const deformationScale = ref(10);
  const selectedElement = ref<number | null>(null);
  const heatmapMode = ref<'stress' | 'strain' | 'force'>('stress');
  const groups = ref<ElementGroup[]>([]);
  const selectedGroupId = ref<string | null>(null);
  const showGroupColors = ref(false);
  const nextGroupId = ref(1);

  // ─── Actions ──────────────────────────────────────────────────────────────
  function loadPreset(name: string) {
    selectedPreset.value = name;
    result.value = null;
    selectedElement.value = null;
    groups.value = [];
    selectedGroupId.value = null;
    nextGroupId.value = 1;
    switch (name) {
      case 'cantilever':
        model.value = presetCantileverBeam();
        break;
      case 'bridge':
        model.value = presetBridgeTruss();
        break;
      case 'frame':
        model.value = presetSimpleFrame();
        break;
      default:
        model.value = presetCantileverBeam();
    }
  }

  function solve() {
    result.value = feaSolve(model.value);
  }

  function toggleDeformed() {
    showDeformed.value = !showDeformed.value;
  }

  function selectElement(id: number | null) {
    selectedElement.value = id;
  }

  function setHeatmapMode(mode: 'stress' | 'strain' | 'force') {
    heatmapMode.value = mode;
  }

  function addLoad(nodeId: number, fx: number, fy: number) {
    model.value.loads.push({ nodeId, fx, fy });
  }

  function toggleFixed(nodeId: number) {
    const node = model.value.nodes.find((n) => n.id === nodeId);
    if (node) node.fixed = !node.fixed;
  }

  // ─── Group Management ────────────────────────────────────────────────────────────
  function generateGroupId(): string {
    return `g${nextGroupId.value++}`;
  }

  function createGroup(name: string, category: GroupCategory, color: string, description?: string): string {
    const id = generateGroupId();
    groups.value.push({
      id,
      name,
      category,
      color,
      elementIds: [],
      description,
    });
    return id;
  }

  function deleteGroup(groupId: string) {
    const idx = groups.value.findIndex((g) => g.id === groupId);
    if (idx !== -1) {
      groups.value.splice(idx, 1);
      if (selectedGroupId.value === groupId) {
        selectedGroupId.value = null;
      }
    }
  }

  function updateGroup(groupId: string, updates: Partial<Omit<ElementGroup, 'id'>>) {
    const group = groups.value.find((g) => g.id === groupId);
    if (group) {
      Object.assign(group, updates);
    }
  }

  function selectGroup(groupId: string | null) {
    selectedGroupId.value = groupId;
  }

  function addElementsToGroup(groupId: string, elementIds: number[]) {
    const group = groups.value.find((g) => g.id === groupId);
    if (group) {
      const newIds = elementIds.filter((id) => !group.elementIds.includes(id));
      group.elementIds.push(...newIds);
    }
  }

  function removeElementsFromGroup(groupId: string, elementIds: number[]) {
    const group = groups.value.find((g) => g.id === groupId);
    if (group) {
      group.elementIds = group.elementIds.filter((id) => !elementIds.includes(id));
    }
  }

  function toggleGroupColor() {
    showGroupColors.value = !showGroupColors.value;
  }

  function getElementGroupId(elementId: number): string | null {
    for (const group of groups.value) {
      if (group.elementIds.includes(elementId)) {
        return group.id;
      }
    }
    return null;
  }

  function autoGroupByRegion(): void {
    if (model.value.nodes.length === 0) return;

    const xs = model.value.nodes.map((n) => n.x);
    const ys = model.value.nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const midX = (minX + maxX) / 2;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const midY = (minY + maxY) / 2;

    const regionGroups: { name: string; elementIds: number[] }[] = [
      { name: '左上区域', elementIds: [] },
      { name: '右上区域', elementIds: [] },
      { name: '左下区域', elementIds: [] },
      { name: '右下区域', elementIds: [] },
    ];

    for (const el of model.value.elements) {
      const n1 = model.value.nodes.find((n) => n.id === el.nodeIds[0]);
      const n2 = model.value.nodes.find((n) => n.id === el.nodeIds[1]);
      if (!n1 || !n2) continue;
      const centerX = (n1.x + n2.x) / 2;
      const centerY = (n1.y + n2.y) / 2;

      let regionIdx = 0;
      if (centerX >= midX && centerY >= midY) regionIdx = 1;
      else if (centerX < midX && centerY < midY) regionIdx = 2;
      else if (centerX >= midX && centerY < midY) regionIdx = 3;

      regionGroups[regionIdx].elementIds.push(el.id);
    }

    const colors = ['#ef4444', '#f97316', '#22c55e', '#3b82f6'];
    for (let i = 0; i < regionGroups.length; i++) {
      if (regionGroups[i].elementIds.length > 0) {
        const id = createGroup(regionGroups[i].name, 'region', colors[i], `按几何区域自动划分`);
        addElementsToGroup(id, regionGroups[i].elementIds);
      }
    }
  }

  function autoGroupByUsage(): void {
    if (model.value.elements.length === 0) return;

    const horizontal: number[] = [];
    const vertical: number[] = [];
    const diagonal: number[] = [];

    for (const el of model.value.elements) {
      const n1 = model.value.nodes.find((n) => n.id === el.nodeIds[0]);
      const n2 = model.value.nodes.find((n) => n.id === el.nodeIds[1]);
      if (!n1 || !n2) continue;

      const dx = Math.abs(n2.x - n1.x);
      const dy = Math.abs(n2.y - n1.y);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      if (angle < 15) horizontal.push(el.id);
      else if (angle > 75) vertical.push(el.id);
      else diagonal.push(el.id);
    }

    if (horizontal.length > 0) {
      const id = createGroup('水平构件', 'usage', '#3b82f6', '水平方向受力构件');
      addElementsToGroup(id, horizontal);
    }
    if (vertical.length > 0) {
      const id = createGroup('竖向构件', 'usage', '#22c55e', '竖向承重构件');
      addElementsToGroup(id, vertical);
    }
    if (diagonal.length > 0) {
      const id = createGroup('斜向构件', 'usage', '#a855f7', '斜向支撑/桁架腹杆');
      addElementsToGroup(id, diagonal);
    }
  }

  function clearAllGroups(): void {
    groups.value = [];
    selectedGroupId.value = null;
    nextGroupId.value = 1;
  }

  function computeGroupStats(groupId: string): GroupStats | null {
    const group = groups.value.find((g) => g.id === groupId);
    if (!group || group.elementIds.length === 0) return null;

    const elements = group.elementIds
      .map((id) => model.value.elements.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => e !== undefined);

    if (elements.length === 0) return null;

    const stresses = elements.map((e) => e.stress);
    const strains = elements.map((e) => e.strain);
    const forces = elements.map((e) => e.force);

    const avgStress = stresses.reduce((a, b) => a + b, 0) / stresses.length;
    const maxStress = Math.max(...stresses.map(Math.abs));
    const minStress = Math.min(...stresses);
    const avgStrain = strains.reduce((a, b) => a + b, 0) / strains.length;
    const maxStrain = Math.max(...strains.map(Math.abs));
    const avgForce = forces.reduce((a, b) => a + b, 0) / forces.length;
    const maxForce = Math.max(...forces.map(Math.abs));

    const compressionCount = stresses.filter((s) => s < 0).length;
    const tensionCount = stresses.filter((s) => s > 0).length;

    const variance = stresses.reduce((a, b) => a + (b - avgStress) ** 2, 0) / stresses.length;
    const stressStdDev = Math.sqrt(variance);

    return {
      groupId,
      elementCount: elements.length,
      avgStress,
      maxStress,
      minStress,
      avgStrain,
      maxStrain,
      avgForce,
      maxForce,
      compressionCount,
      tensionCount,
      stressStdDev,
    };
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const maxStress = computed(() => {
    if (!result.value) return 0;
    return result.value.maxStress;
  });

  const maxDisplacement = computed(() => {
    if (!result.value) return 0;
    return result.value.maxDisplacement;
  });

  const elementColors = computed(() => {
    const colors = new Map<number, string>();

    if (showGroupColors.value) {
      for (const el of model.value.elements) {
        const groupId = getElementGroupId(el.id);
        if (groupId) {
          const group = groups.value.find((g) => g.id === groupId);
          colors.set(el.id, group?.color || '#6b7280');
        } else {
          colors.set(el.id, '#374151');
        }
      }
      return colors;
    }

    if (!result.value || model.value.elements.length === 0) {
      for (const el of model.value.elements) {
        colors.set(el.id, '#6b7280');
      }
      return colors;
    }

    let values: number[];
    switch (heatmapMode.value) {
      case 'stress':
        values = result.value.stresses.map(Math.abs);
        break;
      case 'strain':
        values = result.value.strains.map(Math.abs);
        break;
      case 'force':
        values = model.value.elements.map((e) => Math.abs(e.force));
        break;
      default:
        values = result.value.stresses.map(Math.abs);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    for (let i = 0; i < model.value.elements.length; i++) {
      colors.set(
        model.value.elements[i].id,
        jetColormap(values[i], min, max)
      );
    }
    return colors;
  });

  const selectedGroup = computed(() => {
    if (!selectedGroupId.value) return null;
    return groups.value.find((g) => g.id === selectedGroupId.value) || null;
  });

  const allGroupStats = computed((): Map<string, GroupStats> => {
    const statsMap = new Map<string, GroupStats>();
    for (const group of groups.value) {
      const stats = computeGroupStats(group.id);
      if (stats) {
        statsMap.set(group.id, stats);
      }
    }
    return statsMap;
  });

  const ungroupedElementCount = computed(() => {
    let count = 0;
    for (const el of model.value.elements) {
      if (!getElementGroupId(el.id)) {
        count++;
      }
    }
    return count;
  });

  return {
    model,
    result,
    selectedPreset,
    showDeformed,
    deformationScale,
    selectedElement,
    heatmapMode,
    groups,
    selectedGroupId,
    selectedGroup,
    showGroupColors,
    allGroupStats,
    ungroupedElementCount,
    maxStress,
    maxDisplacement,
    elementColors,
    loadPreset,
    solve,
    toggleDeformed,
    selectElement,
    setHeatmapMode,
    addLoad,
    toggleFixed,
    createGroup,
    deleteGroup,
    updateGroup,
    selectGroup,
    addElementsToGroup,
    removeElementsFromGroup,
    toggleGroupColor,
    getElementGroupId,
    autoGroupByRegion,
    autoGroupByUsage,
    clearAllGroups,
    computeGroupStats,
  };
});
