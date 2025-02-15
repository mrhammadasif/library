<script lang="ts" setup>
import { padStart } from 'lodash-es'
import {
  MAX_DATE_TO_SELECT,
  MIN_DATE_TO_SELECT,
} from '~/constants/Constants'

const props = withDefaults(defineProps<{
  label?: string
  name?: string
  readonly?: boolean
  feedback?: string
  copy?: boolean
  disabled?: boolean
  clearable?: boolean | undefined
  labelOnLeft?: boolean
  noLabelPadding?: boolean
  hideFeedback?: boolean
  autocomplete?: string
  placeholder?: string
  min?: Date
  max?: Date
}>(), {
  min: () => MIN_DATE_TO_SELECT,
  max: () => MAX_DATE_TO_SELECT,
  feedback: '',
  autocomplete: 'off',
  hideFeedback: false,
  labelOnLeft: true,
  readonly: false,
  disabled: false,
  placeholder: '',
})

const _date = defineModel<Date>('modelValue')
const modelDate = computed(() => _date.value ? parseDate(_date.value).startOf('month').toUTC(0, { keepLocalTime: true }) : null)
const currentMonthIndex = ref<number>()
const year = ref<number>(new Date().getFullYear())
const minDate = computed(() => props.min ? parseDate(props.min).startOf('month').toUTC(0, { keepLocalTime: true }) : null)
const maxDate = computed(() => props.max ? parseDate(props.max).endOf('month').toUTC(0, { keepLocalTime: true }) : null)

function loadDefaultValues() {
  if (_date.value) {
    const _d = parseDate(_date.value).toUTC(0, { keepLocalTime: true })
    year.value = _d.year
    selectMonth(_d.month - 1)
  }
  else if (maxDate.value && maxDate.value.year > 1) {
    year.value = maxDate.value.year
  }
}

onMounted(() => {
  loadDefaultValues()
})

function selectMonth(index, input = false) {
  if (!isActive(index)) {
    console.log('selectMonth', index, year.value)
    return
  }

  currentMonthIndex.value = index
}

watch(() => year.value, () => {
  currentMonthIndex.value = undefined
  if (minDate.value && (year.value < minDate.value.year)) {
    year.value = minDate.value.year
  }

  if (maxDate.value && (year.value > maxDate.value.year)) {
    year.value = maxDate.value.year
  }
})

watchEffect(() => {
  if (!_date.value) {
    currentMonthIndex.value = undefined
  }
})

function isActive(monthIndex) {
  // const monthIndex = monthsByLang.indexOf(month) + 1
  const sDate = parseDate(`${year.value}-${padStart((monthIndex + 1), 2, '0')}-01`).toUTC(0, { keepLocalTime: true })
  // console.log(`${year.value}-${padStart((monthIndex + 1), 2, '0')}-01`)

  if (minDate.value && maxDate.value) {
    return (sDate >= minDate.value) && (sDate <= maxDate.value)
  }

  if (minDate.value) {
    return sDate >= minDate.value
  }

  if (maxDate.value) {
    return sDate <= maxDate.value
  }

  return false
}

function addOneYear(value) {
  year.value += value
}

const showModal = ref(false)

function onConfirm() {
  try {
    if (year.value === undefined || currentMonthIndex.value === undefined) {
      showModal.value = false
      return
    }

    const g = parseDate(`${year.value}-${(currentMonthIndex.value ?? 0) + 1}-01`).startOf('day').toUTC(0, { keepLocalTime: true })

    if (minDate.value && g < minDate.value) {
      return
    }

    if (maxDate.value && g > maxDate.value) {
      return
    }

    if (!isActive(currentMonthIndex.value)) {
      return
    }

    _date.value = g.toJSDate()
  }
  finally {
    showModal.value = false
  }
}

function showDateModal() {
  loadDefaultValues()

  showModal.value = true
}

function clear() {
  currentMonthIndex.value = undefined
  _date.value = undefined
  showModal.value = false
}
</script>

<template>
  <NFormItem
    class="block w-full"
    :class="{
      'no-min-w': props.noLabelPadding === true,
    }"
    :show-feedback="!props.hideFeedback"
    :label="props.label"
    :show-label="!!props.label"
    :label-placement="props.labelOnLeft ? 'left' : 'top'"
    :label-style="{ fontWeight: 'bold', marginTop: '0.75rem' }"
    :label-props="{
      'data-testid': `label-${props.name ?? 'unknown'}`,
    }"
    :path="props.name">
    <NPopover
      :disabled="props.disabled"
      :show="showModal"
      trigger="manual"
      content-class="pa-0!"
      placement="bottom-start"
      @clickoutside="onConfirm">
      <template #trigger>
        <div
          class="border bg-white rounded px-2 py-1 ma-0 translate-y-3 pointer flex w-full block"
          :class="{
            'blur-1 cursor-not-allowed': props.disabled,
          }"
          @click="showDateModal">
          <i-carbon-calendar-add
            mr-2
            opacity-40 />
          <span v-if="modelDate">
            {{ monthsByLang[modelDate.month - 1] }}, {{ modelDate.year }}
          </span>
          <span v-else>
            {{ props.placeholder }}
          </span>
        </div>
      </template>
      <div
        class="max-w-320px">
        <div
          class="flex-center space-x-2">
          <Btn
            @click="addOneYear(-1)">
            <i-carbon-chevron-left />
          </Btn>
          <div class="min-w-200px">
            <FormNumber
              v-model.number="year"
              :min="props.min && parseDate(props.min).year"
              :max="props.max && parseDate(props.max).year"
              label=""
              :format-number="false"
              hide-feedback
              placeholder="Year" />
          </div>
          <Btn
            @click="addOneYear(+1)">
            <i-carbon-chevron-right />
          </Btn>
        </div>
        <div class="grid grid-cols-3 mt-2 border pa-1 rounded">
          <div
            v-for="(month, monthIndex) in monthsByLang"
            :key="month"
            :class="{
              inactive: !isActive(monthIndex),
              preselected: year === _date?.getFullYear() && monthIndex === _date?.getMonth(),
              selected: (currentMonthIndex === monthIndex),
            }"
            :disabled="!isActive(monthIndex)"
            class="[&.selected]:(text-primary! bg-primary-light! bg-opacity-15! z2 font-bold)
                  [&.preselected]:(bg-gray-4! bg-opacity-10!)
                  [&.inactive]:(text-gray-3 cursor-not-allowed)
                  hover:(bg-gray-1 z2 shadow)
                  px-2 py-3 flex-basis-1/3 pointer relative bg-opacity-10 text-center bg-white transition duration-300"
            @click="selectMonth(monthIndex, true)">
            {{ month }}
          </div>
        </div>
        <div class="flex justify-end mt-2 space-x-2">
          <Btn
            text
            type="secondary"
            @click="clear">
            Clear
          </Btn>
          <div class="flex-grow-1"></div>
          <Btn
            text
            type="error"
            @click="showModal = false">
            Cancel
          </Btn>
          <Btn
            :disabled="Number(currentMonthIndex) < 0 || currentMonthIndex === undefined"
            type="success"
            @click="onConfirm">
            Confirm
          </Btn>
        </div>
      </div>
    </NPopover>
  </NFormItem>
</template>

<style>
.no-min-w.n-form-item.n-form-item--left-labelled .n-form-item-label {
  width: auto;
}
</style>
