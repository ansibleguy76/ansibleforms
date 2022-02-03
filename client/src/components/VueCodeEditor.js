let ace = require('brace');

module.exports = {
    render: function (h) {
        let height = this.height ? this.px(this.height) : '100%'
        let width = this.width ? this.px(this.width) : '100%'
        return h('div', {
            attrs: {
                style: "height: " + height + '; width: ' + width,
            }
        })
    },
    props: {
        value: String,
        lang: true,
        theme: String,
        height: true,
        width: true,
        commands: Array,
        options: Object,
        lazymodel: {type:Boolean,default:false}
    },
    data: function () {
        return {
            editor: null,
            contentBackup: ""
        }
    },
    methods: {
        px: function (n) {
            if (/^\d*$/.test(n)) {
                return n + "px";
            }
            return n;
        }
    },
    watch: {
        value: function (val) {
            if (this.contentBackup !== val) {
                this.editor.session.setValue(val, 1);
                this.contentBackup = val;
            }
        },
        theme: function (newTheme) {
            this.editor.setTheme('ace/theme/' + newTheme);
        },
        lang: function (newLang) {
            this.editor.getSession().setMode(typeof newLang === 'string' ? ('ace/mode/' + newLang) : newLang);
        },
        options: function (newOption) {
            this.editor.setOptions(newOption);
        },
        height: function () {
            this.$nextTick(function () {
                this.editor.resize()
            })
        },
        width: function () {
            this.$nextTick(function () {
                this.editor.resize()
            })
        }
    },
    beforeDestroy: function () {
        this.editor.destroy();
        this.editor.container.remove();
    },
    mounted: function () {
        let vm = this;
        let lang = this.lang || 'text';
        let theme = this.theme || 'chrome';

        require('brace/ext/emmet');
        require('brace/ext/searchbox');

        let editor = vm.editor = ace.edit(this.$el);

        editor.$blockScrolling = Infinity;

        this.$emit('init', editor);

        //editor.setOption("enableEmmet", true);
        editor.getSession().setMode(typeof lang === 'string' ? ('ace/mode/' + lang) : lang);
        editor.setTheme('ace/theme/' + theme);
        if (this.value)
            editor.setValue(this.value, 1);
        this.contentBackup = this.value;

        editor.on('change', function () {
          vm.$emit('dirty');
          if(!vm.lazymodel){
            let content = editor.getValue();
            vm.$emit('input', content);
            vm.contentBackup = content;
          }
        });
        editor.on('blur', function () {
          if(vm.lazymodel){
            let content = editor.getValue();
            vm.$emit('input', content);
            vm.contentBackup = content;
          }
          vm.$emit('blur');
        });
        if (vm.options)
            editor.setOptions(vm.options);

        if (Array.isArray(vm.commands)) {
            vm.commands.forEach((command) => {
                editor.commands.addCommand(command);
            });
        }
    }
}
