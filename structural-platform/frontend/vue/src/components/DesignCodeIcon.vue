<script setup>
defineProps({ code: { type: String, default: '' } })

function star(cx, cy, outer, points = 5, inner = outer * 0.4) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / points
    const radius = index % 2 ? inner : outer
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`
  }).join(' ')
}

const europeanStars = Array.from({ length: 12 }, (_, index) => {
  const angle = -Math.PI / 2 + index * Math.PI / 6
  return star(15 + Math.cos(angle) * 6.4, 10 + Math.sin(angle) * 6.4, 1.15)
})
const americanStars = Array.from({ length: 9 }, (_, row) => {
  const count = row % 2 ? 5 : 6
  return Array.from({ length: count }, (_, column) => star(1 + column * 2 + (row % 2 ? 1 : 0), 0.7 + row * 1.15, 0.48))
}).flat()
const australianStars = [[7.5, 15.3, 3.15, 7], [23.4, 4, 1.65, 7], [19.4, 10.7, 1.65, 7], [27, 9, 1.65, 7], [23.4, 16.7, 1.65, 7], [25.5, 12.9, 0.9, 5]]
  .map(([x, y, radius, points]) => star(x, y, radius, points))
</script>

<template>
  <svg v-if="['EN', 'AISC/ACI', 'AS', 'VN'].includes(code)" class="design-code-icon" :data-design-code="code" viewBox="0 0 30 20" aria-hidden="true" focusable="false">
    <template v-if="code === 'EN'">
      <rect width="30" height="20" fill="#003399" />
      <polygon v-for="(points, index) in europeanStars" :key="index" :points="points" fill="#ffcc00" />
    </template>
    <template v-else-if="code === 'AISC/ACI'">
      <rect width="30" height="20" fill="#fff" />
      <rect v-for="index in 7" :key="index" :y="(index - 1) * 40 / 13" width="30" :height="20 / 13" fill="#b22234" />
      <rect width="12" :height="140 / 13" fill="#3c3b6e" />
      <polygon v-for="(points, index) in americanStars" :key="index" :points="points" fill="#fff" />
    </template>
    <template v-else-if="code === 'AS'">
      <rect width="30" height="20" fill="#00008b" />
      <svg x="0" y="0" width="15" height="10" viewBox="0 0 30 20" overflow="hidden">
        <path d="M0 0 30 20 M30 0 0 20" stroke="#fff" stroke-width="5" />
        <path d="M0 0 30 20 M30 0 0 20" stroke="#c8102e" stroke-width="2" />
        <path d="M15 0V20 M0 10H30" stroke="#fff" stroke-width="7" />
        <path d="M15 0V20 M0 10H30" stroke="#c8102e" stroke-width="4" />
      </svg>
      <polygon v-for="(points, index) in australianStars" :key="index" :points="points" fill="#fff" />
    </template>
    <template v-else>
      <rect width="30" height="20" fill="#da251d" />
      <polygon :points="star(15, 10, 6, 5, 2.3)" fill="#ff0" />
    </template>
  </svg>
</template>

<style scoped>
.design-code-icon { display: inline-block; width: 24px; height: 16px; flex: 0 0 24px; overflow: hidden; border-radius: 2px; box-shadow: 0 0 0 1px rgb(20 40 60 / 15%); vertical-align: middle; }
</style>
