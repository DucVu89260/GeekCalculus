<script setup>
defineProps({ group: { type: String, required: true }, label: { type: String, required: true } })
</script>

<template>
  <svg class="structure-illustration" viewBox="0 0 320 210" role="img" :aria-label="label">
    <rect width="320" height="210" rx="16" fill="#f4f6f8" />
    <path d="M28 178 170 202 297 161 157 135Z" fill="#e2e9ef" />
    <g fill="none" stroke="#dae2e9" stroke-width="1">
      <path d="M30 157 288 157M30 130 288 130M30 103 288 103M30 76 288 76M60 48V185M100 35V191M140 30V195M180 30V195M220 35V186M260 48V178" />
    </g>
    <g v-if="group === 'steel'" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <g stroke="#8ba1b6" stroke-width="8">
        <path d="M105 147V65L176 30 252 70V160M105 65 252 70M176 30V123" />
      </g>
      <g stroke="#365579" stroke-width="9">
        <path d="M64 166V89L135 52 211 95V180M64 89 211 95M135 52V143" />
      </g>
      <g stroke="#365579" stroke-width="4">
        <path d="M64 89 105 65M211 95 252 70M135 52 176 30M64 166 105 147M211 180 252 160M64 91 211 178M64 164 211 97" />
      </g>
      <g stroke="#dce9f1" stroke-width="2">
        <path d="M64 91 135 55 211 97M68 95V161M215 99V177M109 72V144" />
      </g>
      <g fill="#365579" stroke="#fbfcfe" stroke-width="2">
        <path d="m54 168 10-5 12 4-10 6Zm147 13 10-5 12 4-10 6Z" />
      </g>
    </g>
    <g v-else-if="group === 'concrete'" stroke-linejoin="round">
      <g fill="#c5ced7" stroke="#6d8297" stroke-width="2">
        <path d="M80 65 97 70V164L80 159ZM157 42 174 47V142L157 137ZM231 78 248 83V181L231 176Z" />
        <path d="M57 90 74 96V182L57 176ZM132 65 149 71V165L132 159ZM208 105 225 111V200L208 194Z" />
      </g>
      <g fill="#dce3e8" stroke="#6d8297" stroke-width="2">
        <path d="M53 86 159 36 254 78 219 105 130 65 73 96Z" />
        <path d="M53 130 159 80 254 122 219 149 130 109 73 140Z" />
      </g>
      <g fill="#b0bfcc" stroke="#6d8297" stroke-width="2">
        <path d="M53 86V97L73 108 130 77 219 117 254 90V78L219 105 130 65 73 96Z" />
        <path d="M53 130V141L73 152 130 121 219 161 254 134V122L219 149 130 109 73 140Z" />
      </g>
      <g fill="none" stroke="#365579" stroke-width="2">
        <path d="M63 161V177M69 163V180M214 178V196M220 179V198" />
      </g>
    </g>
    <g v-else fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M109 173V83L168 51 227 84V178M109 83 227 84M109 113 227 114M109 143 227 144M148 82V175M187 83V177" stroke="#6d8297" stroke-width="5" />
      <path d="M109 83 168 51 227 84" stroke="#365579" stroke-width="6" />
      <g stroke="#365579" stroke-width="3">
        <path d="M140 24V55m-6-8 6 8 6-8M176 17V47m-6-8 6 8 6-8M209 32V65m-6-8 6 8 6-8" />
        <path d="M35 108H88m-8-6 8 6-8 6M30 139H88m-8-6 8 6-8 6M246 122h40m-8-6 8 6-8 6" />
        <path d="m82 187 19-5 15 9 18-10 16 10 16-8 21 9" />
      </g>
      <path d="M33 83h34q15 0 15-10t-16-10M253 48h17q14 0 14 10t-13 10" stroke="#8ba1b6" stroke-width="2" />
      <circle cx="265" cy="156" r="13" fill="#e6edf5" stroke="#8ba1b6" stroke-width="2" />
      <path d="M265 146v20m-5-15 10 10m0-10-10 10" stroke="#365579" stroke-width="2" />
    </g>
  </svg>
</template>

<style scoped>
.structure-illustration { display: block; width: 100%; height: auto; border-radius: 16px; }
</style>
