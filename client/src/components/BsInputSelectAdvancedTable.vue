<script setup>

  /******************************************************************/
  /*                                                                */
  /*  Bootstrap Input Select Advanced Table component               */
  /*                                                                */
  /*  This component is a table based select component.             */
  /*  It allows to select multiple items from a table.              */
  /*  It is used standalone or as dropdown in advanded select       */
  /*  It allows to filter as well and can show percentage           */
  /*                                                                */
  /*  @props:                                                       */
  /*      values: Array                                             */
  /*      modelValue: Object|Array|String                           */
  /*      multiple: Boolean                                         */
  /*      required: Boolean                                         */
  /*      name: String                                              */
  /*      defaultValue: String|Array|Object                         */
  /*      status: String                                            */
  /*      sizeClass: String                                         */
  /*      columns: Array                                            */
  /*      previewColumn: String                                     */
  /*      valueColumn: String                                       */
  /*      pctColumns: Array                                         */
  /*      filterColumns: Array                                      */
  /*      focus: String                                             */
  /*                                                                */
  /******************************************************************/

  import { useTemplateRef, computed } from "vue";
  import Helpers from "@/lib/Helpers";

  // INIT

  const emit = defineEmits(["update:modelValue", "isSelected", "focusset", "reset"]);
  const queryfilterRef = useTemplateRef("queryfilterRef");

  // DATA

  const selected = ref({});
  const labels = ref([]);
  const valueLabel = ref("");
  const previewLabel = ref("");
  const preview = ref("");
  const queryfilter = ref("");

  // PROPS

  const props = defineProps({
    values: {
      type: Array,
      required: true,
    },
    modelValue: {
      type: [Object, Array, String],
      default: () => { },
    },
    multiple: { type: Boolean, default: false },
    required: { type: Boolean },
    name: { type: String, required: true },
    defaultValue: { type: [String, Array, Object, Number] },
    status: { type: String },
    sizeClass: { type: String },
    columns: { type: Array, default: () => [] },
    previewColumn: { type: String },
    valueColumn: { type: String },
    pctColumns: { type: Array, default: () => [] },
    filterColumns: { type: Array, default: () => [] },
    focus: { type: String },
  });

  // COMPUTED

  const selectedItems = computed(() => {
    return props.values.filter((v, i) => selected.value[i]);
  });
  const checkAll = computed(() => {
    var all = true
    var BreakException = {};
    try {
      for (let i = 0; i < filtered.value.length; i++) {
        if (!selected.value[filtered.value[i].index]) {
          all = false;
        }
      }
    } catch (e) {
      if (e !== BreakException) throw e;
    }
    return all;
  });
  const filtered = computed(() => {
    var cols = [];
    // if filtercolumns, use them
    if (props.filterColumns.length > 0) {
      cols = props.filterColumns;
    } else {
      // if not, take the previewLabel
      if (previewLabel.value) {
        cols.push(previewLabel.value);
      }
    }
    return props.values.reduce(function (filtered, item, i) {
      var found = false;
      if (queryfilter.value) {

        // if the item exists
        if (item) {
          // console.log(item);
          // go over all filterColumns
          if (cols.length > 0) {
            for (const col of cols) {
              // if the column is present

              if (item[col]) {
                // check if the value contains our filter
                found ||= item[col].toString().toLowerCase().includes(queryfilter.value.toLowerCase());
              } else {
                // no item, always pass
                found = true;
              }
            }
          } else {
            // normal array
            found = item
              .toString()
              .toLowerCase()
              .includes(queryfilter.value.toLowerCase());
          }
        }
      } else {
        found = true;
      }
      if (found) {
        filtered.push({ index: i, value: item });
      }
      return filtered;
    }, []);
  });

  // WATCHERS

  watch(() => props.values, (val) => {
    queryfilter.value = "";
    selected.value = {};
    getLabels();
    emit("reset");
  }, { deep: true });
  watch(() => props.focus, (val) => {
    if (val == "content") {
      nextTick(() => {
        queryfilterRef.value.focus({ preventScroll: true })
        emit("focusset");

      });
    }
  });

  // METHODS

  function objectEqual(object1, object2) {
    const keys1 = Object.keys(object1);
    for (let key of keys1) {
      if (object1[key] !== object2[key]) {
        return false;
      }
    }
    return true;
  }

  function highlightFilter(v, label = undefined) {
    var s = (v ?? "") + "";
    var cols = [];
    if (props.filterColumns.length > 0) {
      cols = props.filterColumns;
    } else {
      if (previewLabel.value) {
        cols.push(previewLabel.value);
      }
    }
    if (label && !cols.includes(label)) {
      return Helpers.htmlEncode(s);
    }
    var index;
    var search = queryfilter.value;
    var l = search.length;
    var p1, p2, p3;
    if (s && queryfilter.value) {
      index = s.toLowerCase().indexOf(search.toLowerCase());
      if (index >= 0) {
        p1 = s.slice(0, index);
        p2 = s.slice(index, index + l);
        p3 = s.slice(index + l);
        return `${Helpers.htmlEncode(
          p1
        )}<span class='fw-bold'>${Helpers.htmlEncode(
          p2
        )}</span>${Helpers.htmlEncode(p3)}`;
      } else {
        return Helpers.htmlEncode(s);
      }
    } else {
      return v;
    }
  }
  function isPctColumn(label) {
    return props.pctColumns.includes(label);
  }
  function getProgressHtml(value) {
    var rounded;
    if (!isNaN(value)) {
      rounded = Math.round(parseInt(value));
      if (rounded < 0) rounded = 0;
      if (rounded > 100) rounded = 100;
      return `<div class="progress" role="progressbar" aria-label="Basic example" aria-valuenow="${rounded}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width: ${rounded}%"></div></div>`;
    } else {
      return value;
    }
  }
  function select(i) {
    if (props.multiple) {
      selected.value[i] = !selected.value[i];
    } else {
      var temp = !selected.value[i]; // if single just clear and invert selection
      selected.value = [];
      selected.value[i] = temp;
      emit("isSelected");
    }
    recalc();
  }
  function recalc() {
    var l = selectedItems.value.length;
    var first = selectedItems.value.slice(0, 3);
    if (l > 0) {
      if (l > 3) {
        preview.value =
          first
            .map((i) => {
              return i ? i[previewLabel.value] ?? i : "undefined";
            })
            .join(", ") +
          ", ... (" +
          l +
          " items selected)";
      } else {
        preview.value = first
          .map((i) => {
            return i ? i[previewLabel.value] ?? i : "undefined";
          })
          .join(", ");
      }
    } else {
      preview.value = "";
    }
    if (props.multiple) {
      // multiple and outputObject, return simple array
      if (l > 0) {
        emit("update:modelValue", { values: selectedItems.value, preview: preview.value });
      } else {
        emit("update:modelValue", { values: undefined, preview: preview.value });
      }
    } else {
      if (l > 0)
        emit("update:modelValue", { values: selectedItems.value[0], preview: preview.value });
      else {
        emit("update:modelValue", { values: undefined, preview: preview.value });
      }
    }
  }
  function multicheck() {
    if (!checkAll.value) {
      for (let i = 0; i < filtered.value.length; i++) {
        selected.value[filtered.value[i].index] = true;
      }
    } else {
      for (let i = 0; i < filtered.value.length; i++) {
        selected.value[filtered.value[i].index] = false;
      }
    }
    recalc();
  }
  function reset() {
    for (let i = 0; i < filtered.value.length; i++) {
      selected.value[filtered.value[i].index] = false;
    }
  }
  function getLabels() {
    var previewLabels = [];
    var valueLabels = [];
    preview.value = "";
    previewLabel.value = "";
    valueLabel.value = "";
    if (props.values.length > 0) {
      if (typeof props.values[0] !== "object") {
        labels.value = [];
      } else {
        // get all labels
        labels.value = Object.keys(props.values[0]);

        // filter preview label
        previewLabels = labels.value.filter(
          (item) => item == props.previewColumn
        );
        valueLabels = labels.value.filter((item) => item == props.valueColumn);
      }
      // reduct labels to the ones we want to show
      if (props.columns.length > 0) {
        // limit labels to provided columnslist
        labels.value = props.columns.filter((item) =>
          labels.value.includes(item)
        );
      }
      // if we found a preview label, use it
      if (previewLabels.length > 0) {
        // if we have a specific value column
        previewLabel.value = previewLabels[0]; // set it
      } else if (labels.value.length > 0) {
        // if we didn't find a preview label, use the first visible label
        previewLabel.value = labels.value[0];
      }
      // if we found a value label, use it
      if (valueLabels.length > 0) {
        // if we have a specific value column
        valueLabel.value = valueLabels[0]; // set it
      } else {
        if (labels.value.length > 0) valueLabel.value = labels.value[0];
      }
      if (props.defaultValue == "__auto__" && props.values.length > 0) {
        select(0); // if __auto__ select the first
      } else if (props.defaultValue == "__all__" && props.multiple) {
        // if all is set, we select all
        for (let i = 0; i < props.values.length; i++) {
          select(i);
        }
      } else if (
        props.defaultValue != "__none__" &&
        props.defaultValue != undefined
      ) {
        // if a regular default is set, we select it
        var obj = undefined;
        var defaulttype;
        try {
          obj = JSON.parse(props.defaultValue);
          if (typeof obj == "object") {
            defaulttype = "object";
          }
        } catch (err) {
          obj = undefined;
        }

        if(props.multiple && !Array.isArray(props.defaultValue || [])){
          console.log("You can't set a default value for a multiple select that is not an array")
          return
        }
        if(!props.multiple && Array.isArray(props.defaultValue || '')){
          console.log("You can't set a default value for a non multiple select that is an array")
          // this.$toast.error("You can't set a default value for a non multiple select that is an array")
          return
        }         

        if (typeof props.defaultValue == "object") {
          obj = props.defaultValue;
          defaulttype = "object";
        }
        if (defaulttype == "object" && !Array.isArray(props.defaultValue)) {
          // enum is of type object, we compare objects
          if (obj) {
            // loop all values
            for (let i = 0; i < props.values.length; i++) {
              try {
                if (objectEqual(obj, props.values[i])) {
                  select(i);
                }
              } catch (err) {
                console.log("Bad defaultvalue : " + err.toString());
              }
            }
          }
        }else if(props.multiple && Array.isArray(props.defaultValue) && props.defaultValue.length>0 && typeof props.defaultValue[0] == "object"){
              // multiple enum of type object // compare objects
              for(var i=0;i<props.values.length;i++){
                  for(var j=0;j<props.defaultValue.length;j++){
                    if(objectEqual(props.values[i],props.defaultValue[j])){
                      select(i)
                    }
                  }
              }           
        } else {
          // we search for the value by string
          for (let i = 0; i < props.values.length; i++) {
            if (
              props.values[i] &&
              props.defaultValue ==
              (props.values[i][valueLabel.value] || props.values[i])
            ) {
              select(i);
            } else if (
              props.multiple &&
              Array.isArray(props.defaultValue) &&
              props.defaultValue.length > 0
            ) {
              if (
                props.values[i] &&
                props.defaultValue.includes(
                  props.values[i][valueLabel.value] || props.values[i] || false
                )
              ) {
                select(i);
              }
            }
          }
        }
      } else {
        recalc();
      }
    }
  }

  // HOOKS

  onMounted(() => {
    reset();
    getLabels();
  });

  // ON SHOW


</script>
<template>
  <div class="my-2">
    <div class="px-3 pb-2">

      <div class="input-group">
        <span class="input-group-text text-gray-500">
          <FaIcon icon="search" />
        </span>
        <input class="form-control" tabindex="0" ref="queryfilterRef" type="text" placeholder="" v-model="queryfilter" />
      </div>

    </div>
    <p v-if="values.length == 0" class="pl-3">No data</p>
    <p v-if="values.length > 0 && filtered.length == 0" class="ps-3">
      Filter returns no results
    </p>
    <div class="table-container">
      <table class="table table-hover mb-0">
        <thead v-if="labels.length > 1">
          <tr :class="sizeClass">
            <th v-if="multiple" class="is-first">
              <font-awesome-icon v-show="checkAll" @click="multicheck()" :icon="['far', 'check-square']" />
              <font-awesome-icon v-show="!checkAll" @click="multicheck()" :icon="['far', 'square']" />
            </th>
            <th :key="l" v-for="l in labels">{{ l }}</th>
          </tr>
        </thead>
        <thead v-if="labels.length <= 1 && multiple">
          <tr :class="sizeClass">
            <th v-if="multiple" class="is-first">
              <font-awesome-icon v-show="checkAll" @click="multicheck()" :icon="['far', 'check-square']" />
              <font-awesome-icon v-show="!checkAll" @click="multicheck()" :icon="['far', 'square']" />
            </th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr :class="{
            'table-primary': selected[v.index],
            sizeClass: sizeClass,
          }" :key="v.index" v-for="v in filtered" @click="select(v.index)">
            <td v-if="multiple" class="is-first">
              <font-awesome-icon v-show="selected[v.index]" :icon="['far', 'check-square']" />
              <font-awesome-icon v-show="!selected[v.index]" :icon="['far', 'square']" />
              <small class="ms-1 text-body-tertiary user-select-none">{{ v.index }}</small>
            </td>
            <template v-for="(l, i) in labels">
              <td v-if="isPctColumn(l)" :key="l + i" v-html="getProgressHtml(v.value[l])"></td>
              <td v-else v-html="highlightFilter(v.value[l], l)" :key="l"></td>
            </template>
            <td v-if="labels.length == 0" v-html="highlightFilter(v.value)"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<style scoped>
.table td,
.table th {
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

table tbody {
  display: block;
  max-height: 300px;
  overflow-y: scroll;
}

table thead,
table tbody tr {
  display: table;
  width: calc(100% - 17px);
  table-layout: fixed;
}

table tbody tr {
  display: table;
  width: 100% !important;
  table-layout: fixed;
  cursor: pointer;
}

table thead th.is-first,
table tbody td.is-first {
  width: 4em !important;
  max-width: 4em !important;
}
</style>
