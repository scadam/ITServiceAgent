(function process(request, response) {
    try {
        var raw = request.body.dataString;
        gs.info("[CatalogOrder] Raw JSON: " + raw);

        var envelope = JSON.parse(raw);
        var body = (envelope.clientData && envelope.clientData.Data) || envelope.data || envelope;

        if (body && body.data) {
            body = body.data;
        }
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }

        gs.info("[CatalogOrder] Normalized body: " + JSON.stringify(body));

        // Validate catalog item id
        if (!body || !body.catalogItemId) {
            response.setStatus(400);
            return { error: 'catalogItemId is required' };
        }
        var itemSysId = String(body.catalogItemId);

        // Quantity validation
        var quantity = body.quantity ? String(body.quantity) : "1";
        if (!/^\+?([0-9]+)$/.test(quantity)) {
            response.setStatus(400);
            return { error: 'Invalid quantity format. Must be a positive integer string.' };
        }

        // --- Build variables from slots + metadata ---
        var variables = {};
        var meta = [];
        if (body.variablesMetadata) {
            try {
                meta = JSON.parse(body.variablesMetadata);
            } catch (e) {
                gs.error("[CatalogOrder] Invalid variablesMetadata: " + e.message);
            }
        }

        if (meta.length) {
            for (var i = 0; i < meta.length; i++) {
                var m = meta[i]; // {slot:"1", id:"acrobat", type:"checkbox", ...}
                var slotKey = m.slot;
                if (!body.hasOwnProperty(slotKey)) continue;

                var rawVal = body[slotKey];
                var coerced = coerceValue(rawVal, m.type);

                // Skip empty strings, nulls, or empty arrays
                if (coerced === '' || coerced === null) continue;
                if (Array.isArray(coerced) && coerced.length === 0) continue;

                variables[m.id] = coerced;
            }
        }

        gs.info("[CatalogOrder] Collected variables: " + JSON.stringify(variables));

        // --- Call the Service Catalog REST API ---
        var endpoint = gs.getProperty('glide.servlet.uri') +
            'api/sn_sc/servicecatalog/items/' + itemSysId + '/order_now';

        var r = new sn_ws.RESTMessageV2();
        r.setHttpMethod('POST');
        r.setEndpoint(endpoint);
        r.setRequestHeader("Accept", "application/json");
        r.setRequestHeader("Content-Type", "application/json");
        r.setBasicAuth("admin", "<pwd>"); // replace with credential alias

        var requestBody = {
            sysparm_quantity: quantity,
            sysparm_id: itemSysId,
            variables: variables
        };
        gs.info("[CatalogOrder] Outgoing request body: " + JSON.stringify(requestBody));
        r.setRequestBody(JSON.stringify(requestBody));

        var res = r.execute();
        var resStatus = res.getStatusCode();
        var resBody = res.getBody();

        if (resStatus !== 200) {
            response.setStatus(resStatus);
            return { error: 'Failed to place order', details: resBody };
        }

        var parsed = JSON.parse(resBody);
        response.setStatus(200);
        return {
            result: {
                number: parsed.result.request_number,
                sys_id: parsed.result.request_id,
                opened_by: gs.getUserID()
            }
        };

        // --- Helpers ---
        function coerceValue(value, type) {
            var v = value;
            switch (type) {
                case 'checkbox':
                    return (String(v) === 'true' || v === true || String(v) === '1');
                case 'integer':
                    if (v === '' || v == null) return null;
                    var iv = parseInt(v, 10);
                    return isNaN(iv) ? null : iv;
                case 'number':
                    if (v === '' || v == null) return null;
                    var fv = parseFloat(v);
                    return isNaN(fv) ? null : fv;
                case 'multichoice':
                    if (Array.isArray(v)) return v;
                    return (typeof v === 'string' && v.length) ? v.split(',') : [];
                case 'date':
                case 'datetime':
                    return v || '';
                default:
                    return v == null ? '' : String(v);
            }
        }

    } catch (e) {
        gs.error("[CatalogOrder] Exception: " + e.message + " " + e.stack);
        response.setStatus(500);
        return { error: 'Unexpected failure', detail: e.message };
    }
})(request, response);
