(function process(request, response) {
    var body = parseBody(request, response);
    if (!body) return;

    var itemSysId = body.catalogItemId || body.itemSysId;
    var variableId = body.variableId;
    var term = (body.searchTerm || '').trim();

    if (!itemSysId || !variableId) {
        response.setStatus(400);
        return { error: 'catalogItemId and variableId are required' };
    }

    // If no explicit searchTerm, look for the {variableId}_search input that was submitted
    if (!term && body.hasOwnProperty(variableId + '_search')) {
        term = String(body[variableId + '_search'] || '').trim();
    }

    // 1) Load base variables the same way as the GET endpoint
    var data = getVariablesForItem(itemSysId);
    if (data.error) {
        response.setStatus(404);
        return data;
    }

    // 2) Find target variable and ensure it's reference type
    var targetIndex = -1;
    for (var i = 0; i < data.variables.length; i++) {
        if (data.variables[i].id === variableId) {
            targetIndex = i;
            break;
        }
    }
    if (targetIndex === -1 || data.variables[targetIndex].type !== 'table' || !data.variables[targetIndex].reference) {
        response.setStatus(400);
        return { error: 'Variable not found or not a reference type', variableId: variableId };
    }

    // 3) Lookup choices with search term (limit 25)
    var refTable = data.variables[targetIndex].reference.table;
    var displayField = data.variables[targetIndex].reference.displayField;
    data.variables[targetIndex].choices = findReferenceChoices(refTable, displayField, term, 25);

    // 4) Reapply current values from submitted inputs so nothing is lost on re-render
    for (var j = 0; j < data.variables.length; j++) {
        var vid = data.variables[j].id;
        if (body.hasOwnProperty(vid)) {
            data.variables[j].value = body[vid];
        }
    }

    return data;

    // Helpers

    function parseBody(req, res) {
        var raw = req.body && req.body.data ? req.body.data : req.body;
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch (e) { res.setStatus(400); return null; }
        }
        return raw || {};
    }

    function getVariablesForItem(itemSysId) {
        var item = new GlideRecord('sc_cat_item');
        if (!item.get(itemSysId)) {
            return { error: 'Catalog item not found', catalogItemId: itemSysId };
        }

        var result = {
            catalogItemId: itemSysId,
            title: item.getValue('name') || '',
            variables: []
        };

        var varGR = new GlideRecord('item_option_new');
        varGR.addQuery('cat_item', itemSysId);
        varGR.orderBy('order');
        varGR.query();

        while (varGR.next()) {
            var typeInfo = mapVariableType(varGR);
            var variable = {
                id: varGR.getValue('name') || varGR.getUniqueValue(),
                label: varGR.getValue('question_text') || varGR.getValue('name') || '',
                type: typeInfo.type,
                ui: typeInfo.ui || {},
                mandatory: varGR.getValue('mandatory') === 'true' || varGR.getValue('mandatory') === '1',
                value: getDefaultValue(varGR, typeInfo),
                choices: []
            };

            if (typeInfo.choiceSource === 'item_option_choice') {
                var choiceGR = new GlideRecord('item_option_choice');
                choiceGR.addQuery('question', varGR.getUniqueValue());
                choiceGR.orderBy('order');
                choiceGR.query();
                while (choiceGR.next()) {
                    variable.choices.push({
                        title: choiceGR.getValue('text'),
                        value: choiceGR.getValue('value'),
                        sys_id: choiceGR.getUniqueValue()
                    });
                }
            }

            if (typeInfo.choiceSource === 'reference') {
                var refTable = varGR.getValue('reference') || '';
                var displayField = getReferenceDisplayField(refTable);
                variable.reference = {
                    table: refTable,
                    displayField: displayField,
                    lazyLoad: true
                };
            }

            result.variables.push(variable);
        }

        return result;
    }

    function mapVariableType(gr) {
        var rawType = gr.getValue('type');
        var multi = gr.getValue('multi') === 'true' || gr.getValue('multi') === '1';
        var mapped = { type: 'text', ui: {}, choiceSource: null };

        switch (rawType) {
            case '1':
            case 'string':
                mapped.type = 'text';
                mapped.ui = { multiline: false };
                break;
            case '2':
            case 'text':
                mapped.type = 'text';
                mapped.ui = { multiline: true };
                break;
            case '3':
            case 'select':
                mapped.type = multi ? 'multichoice' : 'choice';
                mapped.choiceSource = 'item_option_choice';
                break;
            case '8':
            case 'multi_select':
                mapped.type = 'multichoice';
                mapped.choiceSource = 'item_option_choice';
                break;
            case '19':
            case 'reference':
                mapped.type = 'table';
                mapped.choiceSource = 'reference';
                break;
            case '7':
            case 'boolean':
                mapped.type = 'checkbox';
                break;
            case '4':
            case 'integer':
                mapped.type = 'integer';
                break;
            case '5':
            case 'decimal':
                mapped.type = 'number';
                break;
            case '9':
            case 'date':
                mapped.type = 'date';
                break;
            case '10':
            case 'datetime':
            case 'date_time':
                mapped.type = 'datetime';
                break;
            default:
                mapped.type = 'text';
                mapped.ui = { multiline: false };
        }
        return mapped;
    }

    function getDefaultValue(gr, typeInfo) {
        var dv = gr.getValue('default_value') || '';
        if (typeInfo.type === 'checkbox') return (dv === 'true' || dv === '1');
        if (typeInfo.type === 'multichoice') return dv ? dv.split(',') : [];
        return dv;
    }

    function getReferenceDisplayField(tableName) {
        if (!tableName) return 'name';
        var td = GlideTableDescriptor.get(tableName);
        if (td && td.getDisplayName()) return td.getDisplayName();
        return 'name';
    }

    function findReferenceChoices(tableName, displayField, term, limit) {
        var gr = new GlideRecord(tableName);
        if (term) gr.addQuery(displayField, 'CONTAINS', term);
        if (gr.isValidField('active')) gr.addQuery('active', true);
        gr.orderBy(displayField);
        gr.setLimit(limit || 25);
        gr.query();
        var out = [];
        while (gr.next()) {
            out.push({
                title: gr.getValue(displayField),
                sys_id: gr.getUniqueValue(),
                value: gr.getUniqueValue()
            });
        }
        return out;
    }
})(request, response);