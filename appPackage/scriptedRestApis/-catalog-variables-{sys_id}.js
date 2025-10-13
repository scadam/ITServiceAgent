(function process(request, response) {
    var itemSysId = request.pathParams.sys_id;

    var result = {
        catalogItemId: itemSysId,
        title: '',
        variables: [] // ordered, includes labels for display
    };

    // Resolve catalog item
    var item = new GlideRecord('sc_cat_item');
    if (!item.get(itemSysId)) {
        response.setStatus(404);
        return { error: 'Catalog item not found', catalogItemId: itemSysId };
    }
    result.title = item.getValue('name') || '';

    // Fetch variables in display order
    var varGR = new GlideRecord('item_option_new');
    varGR.addQuery('cat_item', itemSysId);
    varGR.orderBy('order');
    varGR.query();

    var metadataArray = [];
    var slot = 1;

    while (varGR.next() && slot <= 10) {
        var typeInfo = mapVariableType(varGR);

        var variable = {
            id: deriveId(varGR, typeInfo),
            label: varGR.getValue('question_text') || varGR.getValue('name') || '',
            type: typeInfo.type,
            ui: typeInfo.ui || {},
            mandatory: toBool(varGR.getValue('mandatory')),
            displayOnly: (typeInfo.type === 'label'),
            value: typeInfo.type === 'label' ? null : getDefaultValue(varGR, typeInfo),
            choices: []
        };

        // Populate choices when sourced from question_choice
        if (typeInfo.choiceSource === 'question_choice') {
            var choiceGR = new GlideRecord('question_choice');
            choiceGR.addQuery('question', varGR.getUniqueValue());
            choiceGR.orderBy('order');
            choiceGR.query();
            while (choiceGR.next()) {
                variable.choices.push({
                    title: choiceGR.getValue('text'),
                    value: choiceGR.getUniqueValue(),
                    sys_id: choiceGR.getUniqueValue()
                });
            }
        }

        // Reference table metadata
        if (typeInfo.choiceSource === 'reference') {
            var refTable = varGR.getValue('reference') || '';
            variable.reference = {
                table: refTable,
                displayField: getReferenceDisplayField(refTable),
                lazyLoad: true
            };
        }

        // Assign slot only if interactive
        if (!variable.displayOnly) {
            variable.slot = String(slot);
            metadataArray.push({
                slot: String(slot),
                id: variable.id,
                type: variable.type,
                mandatory: variable.mandatory === true,
                ui: variable.ui || {}
            });
            slot++;
        }

        result.variables.push(variable);
    }

    // Emit variablesMetadata with slot mapping
    result.variablesMetadata = JSON.stringify(metadataArray);

    return result;

    // --- Helpers ---
    function mapVariableType(gr) {
        var rawType = gr.getValue('type');
        var mapped = { type: 'text', ui: {}, choiceSource: null };

        if (rawType === '11') { // Label
            mapped.type = 'label';
            mapped.ui = { multiline: false };
            return mapped;
        }

        switch (rawType) {
            case '1': case 'string':
                mapped.type = 'text'; mapped.ui = { multiline: false }; break;
            case '2': case 'text':
                mapped.type = 'text'; mapped.ui = { multiline: true }; break;
            case '3': case 'select':
                mapped.type = 'choice'; mapped.choiceSource = 'question_choice'; break;
            case '8': case 'multi_select':
                mapped.type = 'multichoice'; mapped.choiceSource = 'question_choice'; break;
            case '19': case '5': case 'reference':
                mapped.type = 'table'; mapped.choiceSource = 'reference'; break;
            case '7': case 'boolean':
                mapped.type = 'checkbox'; break;
            case '4': case 'integer':
                mapped.type = 'integer'; break;
            case 'decimal':
                mapped.type = 'number'; break;
            case '9': case 'date':
                mapped.type = 'date'; break;
            case '10': case 'datetime': case 'date_time':
                mapped.type = 'datetime'; break;
            default:
                mapped.type = 'text'; mapped.ui = { multiline: false };
        }
        return mapped;
    }

    function deriveId(gr, typeInfo) {
        var name = gr.getValue('name');
        return name && name.trim().length ? name : gr.getUniqueValue();
    }

    function getDefaultValue(gr, typeInfo) {
        var dv = gr.getValue('default_value') || '';
        if (typeInfo.type === 'checkbox') return toBool(dv);
        if (typeInfo.type === 'multichoice') return dv ? dv.split(',') : [];
        return dv;
    }

    function toBool(s) {
        return (s === 'true' || s === '1');
    }

    function getReferenceDisplayField(tableName) {
        if (!tableName) return 'name';
        var td = GlideTableDescriptor.get(tableName);
        if (td && td.getDisplayName()) return td.getDisplayName();
        return 'name';
    }
})(request, response);