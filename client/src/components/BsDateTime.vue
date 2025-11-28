<script setup>

    /******************************************************************/
    /*                                                                */
    /*  Bootstrap Date Time component                                 */
    /*                                                                */
    /*  @props:                                                       */
    /*      hasError: Boolean                                         */
    /*      name: String                                              */
    /*      dateType: String                                          */
    /*      icon: String                                              */
    /*                                                                */
    /*  @emit:                                                        */
    /*      change: Event                                              */
    /*                                                                */
    /******************************************************************/

    import { computed } from 'vue';
    import { useAppStore } from "@/stores/app";

    // MODEL

    const model = defineModel();

    // INIT

    const store = useAppStore();
    const emit = defineEmits(["change"]);

    // PROPS
    
    const props = defineProps({
        hasError: { type: Boolean, default: false },
        name: { type: String, default: "" },
        dateType: { type: String, default: "date" },
        icon: { type: String, default: "calendar" },
        errors: { type: Array, default: () => [] },
        placeholder: { type: String, default: "" },
    });
    
    // DATA

    const hasFocus = ref(false);

    // COMPUTED

    const theme = computed(() => store.theme);
    const hasTimePicker = computed(() => {
        return ["datetime", "time"].includes(props.dateType);
    });    

    // METHODS

    function focus(event){
        hasFocus.value = true;
    }
    function blur(event){
        hasFocus.value = false;
    }
    function input(value) {
        emit("change", value);
    }

    function format(date) {
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear()
        const dayNum = date.getUTCDay() || 7;
        var tempWeekDate = new Date(date)
        tempWeekDate.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(tempWeekDate.getUTCFullYear(),0,1));
        const weekNumber = Math.ceil((((tempWeekDate - yearStart) / 86400000) + 1)/7);

        if(props.dateType == "date") {
            return `${year}-${month}-${day}`
        }
        if(props.dateType == "datetime"){
            return `${year}-${month}-${day} ${hour}:${minute}`
        }
        if(props.dateType == "time"){
            return `${hour}:${minute}`
        }
        if(props.dateType == "month"){
            return `${year}-${month}`
        }
        if(props.dateType == "year"){
            return `${year}`
        }
        if(props.dateType == "week"){
            return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
        }
    }

</script>
<template>

    <VueDatePicker text-input v-model="model" timezone="utc" @blur="blur" :auto-apply="['date','month','week'].includes(dateType)" @focus="focus" @input="input" :formats="{input:format, preview:format}" enable-time-picker="hasTimePicker" :month-picker="dateType == 'month'" :week-picker="dateType == 'week'" :quarter-picker="dateType == 'quarter'" :year-picker="dateType == 'year'" :time-picker="dateType == 'time'" :is-24="true" :dark="theme=='dark'">
        <template #dp-input="{ value }">
        <!-- ICON FIELD GROUP -->
        <div class="input-group">
            <!-- ICON -->
            <span class="input-group-text" :class="{'text-body':hasFocus,'text-gray-500':!hasFocus}" >
                <FaIcon :fixedwidth="true" :icon="icon" />
            </span>        
            <input :class="{ 'is-invalid': hasError }" class="form-control" @blur="blur" @focus="focus" :placeholder="placeholder" :name="name" :value="value" type="text" />
        </div>
        </template>
    </VueDatePicker>

</template>
<style scoped lang="scss">
.invalid-feedback {
  display: block!important;
}
p {
  margin: 0;
}

</style>
