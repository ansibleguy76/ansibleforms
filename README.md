# Intro
Ansible forms is a lightweight node.js webapplication to generate userfriendly and pretty forms to kickoff ansible playbooks or awx (ansible tower) templates.

# Configuration / documentation
[Go to the documentation website](https://ansibleforms.com)

# Custom Configuration Options

| ENV VAR         | Description                                                                                                                                                   |
|-----------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| SHOW_DESIGNER   | Show the designer in the menu bar                                                                                                                             |
| USE_YTT         | Use https://carvel.dev/ytt/ for yaml templating                                                                                                               |
| YTT_VARS_PREFIX | ENV var prefix for ytt data variables                                                                                                                         |
| YTT_LIB_DATA_*  | Data value files for ytt libraries. * is the name of the library. e.g. YTT_LIB_DATA_PAYLOADS=/tmp/payloads.yml. The data will be provided to forms.yaml only! |
