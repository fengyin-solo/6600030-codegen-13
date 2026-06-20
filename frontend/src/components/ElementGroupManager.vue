<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFEAStore } from '../store/fea';
import type { GroupCategory } from '../types';

const store = useFEAStore();

const newGroupName = ref('');
const newGroupCategory = ref<GroupCategory>('custom');
const newGroupColor = ref('#8b5cf6');
const newGroupDescription = ref('');
const showCreateForm = ref(false);
const editingGroupId = ref<string | null>(null);
const editingName = ref('');
const editingColor = ref('');
const editingDescription = ref('');

const categoryLabels: Record<GroupCategory, string> = {
  region: '区域',
  usage: '用途',
  custom: '自定义',
};

const presetColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

const canAddSelected = computed(() => {
  return store.selectedElement !== null && store.selectedGroupId !== null;
});

function handleCreateGroup() {
  if (!newGroupName.value.trim()) return;
  store.createGroup(
    newGroupName.value.trim(),
    newGroupCategory.value,
    newGroupColor.value,
    newGroupDescription.value.trim() || undefined
  );
  newGroupName.value = '';
  newGroupDescription.value = '';
  showCreateForm.value = false;
}

function startEditGroup(groupId: string) {
  const group = store.groups.find((g) => g.id === groupId);
  if (!group) return;
  editingGroupId.value = groupId;
  editingName.value = group.name;
  editingColor.value = group.color;
  editingDescription.value = group.description || '';
}

function saveEditGroup() {
  if (!editingGroupId.value || !editingName.value.trim()) return;
  store.updateGroup(editingGroupId.value, {
    name: editingName.value.trim(),
    color: editingColor.value,
    description: editingDescription.value.trim() || undefined,
  });
  cancelEditGroup();
}

function cancelEditGroup() {
  editingGroupId.value = null;
  editingName.value = '';
  editingColor.value = '';
  editingDescription.value = '';
}

function addSelectedToGroup() {
  if (store.selectedElement === null || store.selectedGroupId === null) return;
  store.addElementsToGroup(store.selectedGroupId, [store.selectedElement]);
}

function removeSelectedFromGroup() {
  if (store.selectedElement === null || store.selectedGroupId === null) return;
  store.removeElementsFromGroup(store.selectedGroupId, [store.selectedElement]);
}

function getGroupStats(groupId: string) {
  return store.allGroupStats.get(groupId) || null;
}

function getForceCharacteristic(stats: { tensionCount: number; compressionCount: number }): string {
  const total = stats.tensionCount + stats.compressionCount;
  if (total === 0) return '—';
  if (stats.tensionCount === 0) return '全受压';
  if (stats.compressionCount === 0) return '全受拉';
  const tensionRatio = stats.tensionCount / total;
  if (tensionRatio > 0.7) return '以受拉为主';
  if (tensionRatio < 0.3) return '以受压为主';
  return '拉压混合';
}
</script>

<template>
  <div class="bg-slate-800 rounded-lg p-4 space-y-4">
    <div class="flex items-center justify-between border-b border-slate-700 pb-2">
      <h3 class="text-sm font-bold text-slate-200">
        构件分组管理
      </h3>
      <span class="text-xs text-slate-500">
        {{ store.groups.length }} 组 | {{ store.ungroupedElementCount }} 未分组
      </span>
    </div>

    <!-- Auto-group buttons -->
    <div class="grid grid-cols-2 gap-2">
      <button
        @click="store.autoGroupByRegion()"
        class="py-2 px-3 rounded text-xs font-medium bg-sky-700 hover:bg-sky-600 text-white transition"
      >
        🗺 按区域分组
      </button>
      <button
        @click="store.autoGroupByUsage()"
        class="py-2 px-3 rounded text-xs font-medium bg-emerald-700 hover:bg-emerald-600 text-white transition"
      >
        🏗 按用途分组
      </button>
    </div>

    <!-- Group color toggle -->
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        :checked="store.showGroupColors"
        @change="store.toggleGroupColor()"
        class="accent-purple-500"
      />
      <span class="text-xs text-slate-300">显示分组颜色</span>
    </label>

    <!-- Create new group -->
    <div v-if="!showCreateForm" class="border-t border-slate-700 pt-3">
      <button
        @click="showCreateForm = true"
        class="w-full py-2 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
      >
        + 新建分组
      </button>
    </div>

    <div v-else class="border-t border-slate-700 pt-3 space-y-2">
      <div class="text-xs font-medium text-slate-300">新建分组</div>
      <input
        v-model="newGroupName"
        type="text"
        placeholder="分组名称"
        class="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
      />
      <select
        v-model="newGroupCategory"
        class="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
      >
        <option value="region">按区域</option>
        <option value="usage">按用途</option>
        <option value="custom">自定义</option>
      </select>
      <div>
        <div class="text-xs text-slate-400 mb-1">选择颜色</div>
        <div class="flex gap-1 flex-wrap">
          <button
            v-for="color in presetColors"
            :key="color"
            @click="newGroupColor = color"
            :class="newGroupColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''"
            :style="{ backgroundColor: color }"
            class="w-6 h-6 rounded transition"
          />
        </div>
      </div>
      <input
        v-model="newGroupDescription"
        type="text"
        placeholder="描述（可选）"
        class="w-full px-2 py-1.5 rounded text-xs bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
      />
      <div class="flex gap-2">
        <button
          @click="handleCreateGroup"
          :disabled="!newGroupName.trim()"
          class="flex-1 py-1.5 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition"
        >
          创建
        </button>
        <button
          @click="showCreateForm = false"
          class="py-1.5 px-3 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
        >
          取消
        </button>
      </div>
    </div>

    <!-- Add selected element to group -->
    <div v-if="store.selectedGroupId && store.selectedElement !== null" class="border-t border-slate-700 pt-3">
      <div class="text-xs text-slate-400 mb-2">
        已选单元 #{{ store.selectedElement }}
      </div>
      <div class="flex gap-2">
        <button
          @click="addSelectedToGroup"
          class="flex-1 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition"
        >
          + 加入当前组
        </button>
        <button
          @click="removeSelectedFromGroup"
          class="flex-1 py-1.5 rounded text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition"
        >
          - 移出当前组
        </button>
      </div>
    </div>

    <!-- Group list -->
    <div v-if="store.groups.length > 0" class="border-t border-slate-700 pt-3 space-y-2 max-h-[300px] overflow-y-auto">
      <div
        v-for="group in store.groups"
        :key="group.id"
        @click="store.selectGroup(store.selectedGroupId === group.id ? null : group.id)"
        :class="[
          'rounded p-2 cursor-pointer transition',
          store.selectedGroupId === group.id
            ? 'bg-slate-600 ring-1 ring-purple-400'
            : 'bg-slate-900 hover:bg-slate-700'
        ]"
      >
        <!-- Edit mode -->
        <div v-if="editingGroupId === group.id" @click.stop class="space-y-2">
          <input
            v-model="editingName"
            type="text"
            class="w-full px-2 py-1 rounded text-xs bg-slate-800 border border-slate-600 text-slate-200 focus:outline-none focus:border-purple-500"
          />
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="color in presetColors"
              :key="color"
              @click="editingColor = color"
              :class="editingColor === color ? 'ring-2 ring-white' : ''"
              :style="{ backgroundColor: color }"
              class="w-5 h-5 rounded transition"
            />
          </div>
          <input
            v-model="editingDescription"
            type="text"
            placeholder="描述"
            class="w-full px-2 py-1 rounded text-xs bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <div class="flex gap-2">
            <button
              @click="saveEditGroup"
              class="flex-1 py-1 rounded text-xs font-medium bg-purple-600 text-white"
            >
              保存
            </button>
            <button
              @click="cancelEditGroup"
              class="py-1 px-3 rounded text-xs font-medium bg-slate-700 text-slate-300"
            >
              取消
            </button>
          </div>
        </div>

        <!-- Display mode -->
        <div v-else>
          <div class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-full flex-shrink-0"
              :style="{ backgroundColor: group.color }"
            />
            <span class="text-xs font-medium text-slate-200 truncate flex-1">
              {{ group.name }}
            </span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
              {{ categoryLabels[group.category] }}
            </span>
            <span class="text-[10px] text-slate-500">
              {{ group.elementIds.length }}
            </span>
          </div>
          <div v-if="group.description" class="text-[10px] text-slate-500 mt-1 ml-5">
            {{ group.description }}
          </div>

          <!-- Stats (when expanded) -->
          <div v-if="store.selectedGroupId === group.id" class="mt-2 ml-5 space-y-2">
            <div v-if="getGroupStats(group.id)" class="grid grid-cols-2 gap-1 text-[10px]">
              <div class="bg-slate-800 rounded p-1.5">
                <div class="text-slate-500">平均应力</div>
                <div class="text-slate-200 font-mono font-bold">
                  {{ (getGroupStats(group.id)!.avgStress / 1e6).toFixed(2) }} MPa
                </div>
              </div>
              <div class="bg-slate-800 rounded p-1.5">
                <div class="text-slate-500">最大应力</div>
                <div class="text-red-400 font-mono font-bold">
                  {{ (getGroupStats(group.id)!.maxStress / 1e6).toFixed(2) }} MPa
                </div>
              </div>
              <div class="bg-slate-800 rounded p-1.5">
                <div class="text-slate-500">受拉/压</div>
                <div class="text-slate-200">
                  {{ getGroupStats(group.id)!.tensionCount }} / {{ getGroupStats(group.id)!.compressionCount }}
                </div>
              </div>
              <div class="bg-slate-800 rounded p-1.5">
                <div class="text-slate-500">受力特征</div>
                <div class="text-amber-400 font-medium">
                  {{ getForceCharacteristic(getGroupStats(group.id)!) }}
                </div>
              </div>
              <div class="bg-slate-800 rounded p-1.5">
                <div class="text-slate-500">应力离散</div>
                <div class="text-slate-200 font-mono">
                  {{ (getGroupStats(group.id)!.stressStdDev / 1e6).toFixed(2) }} MPa
                </div>
              </div>
              <div class="bg-slate-800 rounded p-1.5">
                <div class="text-slate-500">平均轴力</div>
                <div class="text-sky-400 font-mono">
                  {{ (getGroupStats(group.id)!.avgForce / 1000).toFixed(2) }} kN
                </div>
              </div>
            </div>
            <div v-else class="text-[10px] text-slate-500 italic">
              先点击「求解 FEA」获取统计结果
            </div>

            <div class="flex gap-1">
              <button
                @click.stop="startEditGroup(group.id)"
                class="flex-1 py-1 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
              >
                编辑
              </button>
              <button
                @click.stop="store.deleteGroup(group.id)"
                class="flex-1 py-1 rounded text-[10px] font-medium bg-red-900 hover:bg-red-800 text-red-300 transition"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-xs text-slate-500 text-center py-4">
      <div class="text-lg mb-1">📦</div>
      暂无分组，点击上方按钮自动分组或手动创建
    </div>

    <!-- Clear all -->
    <div v-if="store.groups.length > 0" class="border-t border-slate-700 pt-3">
      <button
        @click="store.clearAllGroups()"
        class="w-full py-1.5 rounded text-xs font-medium bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-300 transition"
      >
        清除全部分组
      </button>
    </div>
  </div>
</template>
