<script setup>

    /*****************************************************/
    /*                                                   */
    /*  Bootstrap Admin Table Component                  */
    /*  Create a table with actions                      */
    /*                                                   */
    /*  @props:                                          */
    /*      items: Array - List of items to show         */
    /*      busyItems: Object - List of items to show    */
    /*      fields: Array - List of fields to show       */
    /*      idKey: String - Key of the id field          */
    /*      parentLists: Object - List of parent lists   */
    /*      removeDoubles: Boolean - Remove double items */
    /*      actions: Array - List of actions             */
    /*      pagination: Object - Pagination settings     */
    /*                                                   */
    /*  @emit:                                           */
    /*      select: Object - Select an item              */
    /*      edit: Object - Edit an item                  */
    /*      delete: Object - Delete an item              */
    /*      sort: Object - Sort an item                  */
    /*      change_password: Object - Change password    */
    /*      test: Object - Test an item                  */
    /*      preview: Object - Preview an item            */
    /*      trigger: Object - Trigger an item            */
    /*      reset: Object - Reset an item                */
    /*                                                   */
    /*****************************************************/


    import dayjs from 'dayjs';

    // INIT

    const emit = defineEmits(["select", "edit", "delete", "sort", "change_password", "test", "preview","trigger","reset"]);

    // PROPS

    const props = defineProps({
        items: {
            type: Array,
            required: true
        },
        checkboxFields: {
            type: Array,
            default: () => []
        },
        busyItems: {
            type: Object,
            default: () => {
                return {};
            }
        },  
        fields: {
            type: Array,
            required: true
        },
        idKey: {
            type: [String,Number],
            default: 'id'
        },
        parentLists: {
            type: Object,
            default: () => {
                return {};
            }
        },
        removeDoubles: {
            type: Boolean,
            default: false
        },
        actions: {
            type: Array,
            default: () => []
        },
        pagination: {
            type: Object,
            default: () => {
                return {
                    enabled: true,
                    currentId: 0
                };
            }
        }
    });


    // DATA

    const filter = ref('');
    const displayedItems = ref([]);

    // COMPUTED

    const columns = props.fields.map(field => field.key);
    const labels = props.fields.map(field => field.label);
    const hasFilters = props.fields.some(field => field.filterable);


    const filteredItems = computed(() => {
        if (filter.value) {
            return props.items.filter(item => {
                return columns.some(column => {
                    return item[column]?.toString().toLowerCase().includes(filter.value.toLowerCase()) || false;
                });
            });
        } else {
            return props.items;
        }
    });

    const filteredItemsWithoutDoubles = computed(() => {
        if (props.removeDoubles) {
            return filteredItems.value.filter((item, index, self) =>
                index === self.findIndex((t) => (
                    t.name === item.name
                ))
            );
        } else {
            return filteredItems.value;
        }
    });

    const countRemovedDoubleItems = computed(() => {
        return filteredItems.value.length - filteredItemsWithoutDoubles.value.length;
    });

    // METHODS

    const setDisplayedItems = (i) => {
        displayedItems.value = i
    };

    // a method that sets a text part in bold if it matches the filter
    const highlight = (item, column, columnIndex) => {
        var text = '';
        const field = props.fields[columnIndex]; // what field is this?
        if (field.type === 'datetime') {
            const val = item[column];
            text = val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '';
        } else if (field.type == 'select') {  // is this a select field? => then get the label from the parentList
            const parentList = props.parentLists[field.parent] || [];
            try{
                text = parentList.find(listItem => listItem[field.valueKey] == item[field.key])[field.labelKey] // get the foreign label
            } catch (e) {
                text = ''
            }
        } else {
            text = item[column]; // else get the value from the item
        }
        if (filter.value && text != undefined && field.filterable) {
            return text.toString().replace(new RegExp(filter.value, 'gi'), match => {
                return `<b>${match}</b>`;
            }); // make the matching part bold
        } else {
            return text; // no filter, no bold
        }
    };

    // HOOKS
    onMounted(() => {
        setDisplayedItems(filteredItemsWithoutDoubles.value);
    });


</script>
<template>
    <BsInput v-model="filter" v-if="hasFilters" :isFloating="false" placeholder="Search..." icon="search" label="Filter" />
    <div class="alert alert-info mt-3" v-if="countRemovedDoubleItems > 0">
        <strong>{{ countRemovedDoubleItems }}</strong> double items removed for your convenience.
    </div>    
    <table class="table table-bordered table-hover">
        <thead>
            <tr>
                <th class="is-first" v-if="actions.length > 0">Actions</th>
                <template v-for="(label, index) in labels">
                    <th v-if="!fields[index].hidden || false">
                        <span class="me-2">{{ label }}</span>
                        <!-- <span v-if="fields[index].sortable" class="me-2">
                            <FaIcon role="button" color="secondary" icon="sort" @click="console.log('sort')" />
                        </span> -->
                    </th>
                </template>

            </tr>
        </thead>
        <tbody>
            <tr :class="{ 'bg-primary-subtle': pagination.currentId == item[idKey] }" v-for="(item, index) in displayedItems" :key="index">
                <td :class="{ 'bg-primary-subtle': pagination.currentId == item[idKey] }" class="is-first" v-if="actions.length > 0">
                    <span v-for="(action, actionIndex) in actions" class="me-2" :title="action.title">
                        <FaIcon v-if="action.dependency && action.dependencyValues && !action.dependencyValues.includes(item[action.dependency])" color="gray-500" size="sm" :icon="action.icon"></FaIcon>
                        <FaIcon v-else-if="action.dependency && !item[action.dependency]" color="gray-500" size="sm" :icon="action.icon"></FaIcon>
                        <FaIcon v-else role="button" :color="action.color" size="sm" :icon="action.icon" @click="emit(action.name, item)"></FaIcon>
                    </span>
                    <span v-if="Object.keys(busyItems).includes(item[idKey].toString())" :title="busyItems[item[idKey]]">
                        <FaIcon size="sm" icon="spinner" spin></FaIcon>
                    </span>
                </td>
                <template v-for="(column, columnIndex) in columns">
                    <td
                        role="button"
                        @click="emit(actions[0].name, item)"
                        :class="{ 'bg-primary-subtle': pagination.currentId == item[idKey] }"
                        v-if="!fields[columnIndex].hidden || false"
                    >
                        <template v-if="checkboxFields.includes(column)">
                            <span v-if="item[column]">
                                <FaIcon icon="check" color="success" />
                            </span>
                        </template>
                        <template v-else>
                            <span v-html="highlight(item, column, columnIndex)"></span>
                        </template>
                    </td>
                </template>
            </tr>
        </tbody>
    </table>
    <BsPagination 
        v-if="pagination.enabled"
        :dataList="filteredItemsWithoutDoubles"
        :perPage="pagination.pageSize"
        :buttonsShown="7"
        @change="setDisplayedItems"    
    />
</template>
<style scoped>
    .table td,
    .table th {
        max-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    table thead th.is-first,
    table tbody td.is-first {
        width: 11em !important;
        max-width: 11em !important;
    }
</style>