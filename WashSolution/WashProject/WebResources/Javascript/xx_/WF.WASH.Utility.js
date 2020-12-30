//  -------------------------------------------------------------------
//
//  L.Wong (Webfortis) JavaScript Helper Class/Namespaces
//  Copyright © 1996-2014 Webfortis, LLC. All Rights Reserved.
// 
// Ivan Garnica (Avtex) V9 refactor 2018.09.06
//  -------------------------------------------------------------------

if (typeof (WF) == "undefined") {
    WF = {};
}

if (typeof (WF.Util) == "undefined") {
    WF.Util = {};
}


WF.Util = {

    formContext: null,


    init: function (ctx) {

        WF.Util.formContext = ctx.getFormContext();

    },

    //severity: critical = 1, warning = 2, info = 3, -1 = clear
    setNotification: function (msgId, severity, source, text) {

        switch (severity) {
            case 1:
                WF.Util.formContext.ui.setFormNotification(text, "ERROR", msgId);
                break;
            case 2:
                WF.Util.formContext.ui.setFormNotification(text, "WARNING", msgId);
                break;
            case 3:
                WF.Util.formContext.ui.setFormNotification(text, "INFO", msgId);
                break;
            case -1:
                if (msgId == null) WF.Util.formContext.ui.clearFormNotification();
                else WF.Util.formContext.ui.clearFormNotification(msgId);
                break;
            default:
                break;
        }

    },

    addExistingFromSubGridCustom: function (params) {
        var relName;
        var roleOrd;
        var viewId = "{00000000-0000-0000-0000-000000000001}"; // a dummy view ID

        if (typeof (params.gridControl.GetParameter) === "function") { //post rollup 12 
            relName = params.gridControl.GetParameter("relName");
            roleOrd = params.gridControl.GetParameter("roleOrd");
        }
        else { //pre rollup 12 
            relName = params.gridControl.getParameter("relName");
            roleOrd = params.gridControl.getParameter("roleOrd");
        }

        var crmWindow = params.crmWindow == null ? parent.window : params.crmWindow;
        var customView = {
            fetchXml: params.fetchXml,
            id: viewId,
            layoutXml: params.layoutXml,
            name: params.name,
            recordType: params.gridTypeCode,
            Type: 0
        };

        var parentObj = crmWindow.GetParentObject(null, 0);
        var parameters = [params.gridTypeCode, "", relName, roleOrd, parentObj]
        var context = {};
        var callbackRef = crmWindow.Mscrm.Utilities.createCallbackFunctionObject("locAssocObjAction", crmWindow, parameters, false);
        //callbackRef.callback = function (lookupItems) {

        //    if (lookupItems && lookupItems.items.length > 0) {
        //    	crmWindow.AssociateObjects(crmFormSubmit.crmFormSubmitObjectType.value, crmFormSubmit.crmFormSubmitId.value, params.gridTypeCode, lookupItems, IsNull(roleOrd) || roleOrd == 2, "", relName);
        //    }
        //};

        crmWindow.LookupObjectsWithCallback(callbackRef, null, "multi", params.gridTypeCode, 0, null, "", null, null, null, null, null, null, viewId, [customView], null, null, null, null, null, null, 1);

    },

    formatPhoneNumber: function (inputValue) {
        var scrubbed = inputValue.toString().replace(/[^0-9]/g, "");

        var sevenDigitFormat = /^\(?([0-9]{3})[-. ]?([0-9]{4})$/;
        var eightDigitFormat = /^\(?([0-9]{2})[-. ]?([0-9]{3})[-. ]?([0-9]{3})$/;
        var nineDigitFormat = /^\(?([0-9]{2})[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        var tenDigitFormat = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        var elevenDigitFormat = /^\(?([0-9]{1})\)?[-. ]?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        var twelveDigitFormat = /^\(?([0-9]{2})\)?[-. ]?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        var thirteenDigitFormat = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        var fourteenDigitFormat = /^\(?([0-9]{3})\)?[-. ]?([0-9]{1})\)?[-. ]?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        var fifteenDigitFormat = /^\(?([0-9]{3})\)?[-. ]?([0-9]{2})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{3})\)?[-. ]?([0-9]{4})$/;
        var sixteenDigitFormat = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})\)?[-. ]?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        //    var extDigitFormat = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})?([0-9]*)$/;

        if (sevenDigitFormat.test(scrubbed)) {
            return scrubbed.replace(sevenDigitFormat, "$1-$2");
        }
        else if (eightDigitFormat.test(scrubbed)) {
            return scrubbed.replace(eightDigitFormat, "+$1-$2-$3");
        }
        else if (nineDigitFormat.test(scrubbed)) {
            return scrubbed.replace(nineDigitFormat, "(0$1) $2-$3");
        }
        else if (tenDigitFormat.test(scrubbed)) {
            return scrubbed.replace(tenDigitFormat, "($1) $2-$3");
        }
        else if (elevenDigitFormat.test(scrubbed)) {
            return scrubbed.replace(elevenDigitFormat, "+$1 $2-$3-$4");
        }
        else if (twelveDigitFormat.test(scrubbed)) {
            return scrubbed.replace(twelveDigitFormat, "+$1 $2-$3-$4");
        }
        else if (thirteenDigitFormat.test(scrubbed)) {
            return scrubbed.replace(thirteenDigitFormat, "+$1 $2-$3-$4");
        }
        else if (fourteenDigitFormat.test(scrubbed)) {
            return scrubbed.replace(fourteenDigitFormat, "$1-$2-$3-$4-$5");
        }
        else if (fifteenDigitFormat.test(scrubbed)) {
            return scrubbed.replace(fifteenDigitFormat, "$1-$2-$3-$4-$5");
        }
        else if (sixteenDigitFormat.test(scrubbed)) {
            return scrubbed.replace(sixteenDigitFormat, "$1-$2-$3-$4-$5");
        }
        //    else if (extDigitFormat.test(scrubbed)) {
        //        return scrubbed.replace(extDigitFormat, "($1) $2-$3 x$4");
        //    }
        return inputValue;
    },

    //  CRM 2011 UR11 or before only
    registerCheckboxClick: function (attr) {

        var ctrl = WF.Util.formContext.ui.controls.get(attr);
        var a = ctrl.getAttribute();
        var el = document.getElementById(attr);

        // Build Toggle Function
        var f = "var ef=function() { " +
            "var a = WF.Util.formContext.data.entity.attributes.get(attr); " +
            "a.setValue(!a.getValue()); a.fireOnChange();" +
            " };";

        eval(f);

        // Attach to click event
        el.attachEvent('onclick', ef, false);

    },

    // Disable a subgrid on a form 
    disableSubgrid: function (subgridName) {
        document.getElementById(subgridName + "_span").disabled = "true";
    },

    SubGridCount: function (gridId, tabId) {
        /// waits for the new Claimant expenses grid to load before checking for records.
        grid = WF.Util.formContext.ui.controls.get(gridId)._control;

        if (grid.get_innerControl() == null) {
            setTimeout("SubGridCount('" + gridId + "', '" + tabId + "');", 1000);
            return;
        }
        else if (grid.get_innerControl()._element.innerText.search("Loading") != -1) {
            setTimeout("SubGridCount('" + gridId + "', '" + tabId + "');", 1000);
            return;
        }

        var ids = grid.get_innerControl().get_allRecordIds();
        //    if (ids.length > 0) {
        //        WF.Util.formContext.ui.tabs.get(tabId).setVisible(true);
        //    }
        //    else {
        //        WF.Util.formContext.ui.tabs.get(tabId).setVisible(false);
        //    }
        //alert(ids.length);
        return ids.length;
    },

    getCurrentUserFullName: function () {
        var serverUrl;
        if (WF.Util.formContext.context.getClientUrl !== undefined) {
            serverUrl = WF.Util.formContext.context.getClientUrl();
        } else {
            serverUrl = WF.Util.formContext.context.getClientUrl();
        }
        var systemUserId = WF.Util.formContext.context.getUserId();
       // var ODataPath = serverUrl + "/XRMServices/2011/OrganizationData.svc";
        //var ODataPath = serverUrl + "/XRMServices/2011/OrganizationData.svc";
        //var userRequest = new XMLHttpRequest();
        //userRequest.open("GET", ODataPath + "/SystemUserSet(guid'" + WF.Util.formContext.context.getUserId() + "')", false);
        //userRequest.setRequestHeader("Accept", "application/json");
        //userRequest.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        //userRequest.send();
        //if (userRequest.status === 200) {
        //    var retrievedUser = JSON.parse(userRequest.responseText).d;
        //    var userFullName = retrievedUser.FullName;
        //    return userFullName;
        //}
        //else {
        //    return "error";
        //}
        var req = new XMLHttpRequest();
        req.open("GET", serverUrl + "/api/data/v9.1/systemusers(" + systemUserId+")?$select=fullname", true);
        req.setRequestHeader("OData-MaxVersion", "4.0");
        req.setRequestHeader("OData-Version", "4.0");
        req.setRequestHeader("Accept", "application/json");
        req.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        req.setRequestHeader("Prefer", "odata.include-annotations=\"*\"");
        req.onreadystatechange = function () {
            if (this.readyState === 4) {
                req.onreadystatechange = null;
                if (this.status === 200) {
                    var result = JSON.parse(this.response);
                    var fullname = result["fullname"];
                    return fullname;
                } else {
                    var alertStrings = {
                        confirmButtonLabel: "Ok", text: this.statusText

                    };
                    var alertOptions = { height: 120, width: 260 };
                    //New v9.0 Method
                    Xrm.Navigation.openAlertDialog(alertStrings, alertOptions);

                }
            }
        };
        req.send();
    },

    formSwitching: function (targetFormName, targetEntityName) {


        return Xrm.WebApi.retrieveMultipleRecords("systemforms", "?$select=name,formid,formidunique&$filter=name eq '" + targetFormName + "' and objecttypecode eq '" + targetEntityName + "'").then(function (res) {


            var currentFormName = WF.Util.formContext.ui.formSelector.getCurrentItem();


            //alert(WF.Util.formContext.context.getQueryStringParameters().etc);
            if (res != null && currentFormName != null) {
                currentFormName = currentFormName.getLabel();
                if (res.entities.length > 0) {
                    for (var i = 0; i < res.entities.length; i++) {
                        var currentRec = res.entities[i];
                        //alert("Name: " + jsonResult[i].Name + "\n" + "FormId: " + jsonResult[i].FormId);
                        //alert(WF.Util.formContext.ui.formSelector.getCurrentItem().getLabel() + "\n" + currentRec.FormId);
                        if (currentRec.name != null) {
                            var formName = currentRec.name;
                            var formId = currentRec.formid;
                            //alert(currentFormName + "\n" + targetFormName);
                            if (currentFormName.toLowerCase().indexOf(targetFormName.toLowerCase()) == -1 || currentFormName.length != targetFormName.length) {
                                if (WF.Util.formContext.ui.formSelector.items.get(currentRec.formid) != null) {
                                    WF.Util.formContext.ui.formSelector.items.get(currentRec.formid).navigate();
                                }
                            }
                        }
                    }
                }
            }

        });

    },

    UserHasRole: function (roleName) {
        debugger;

        // split rolename string on commas       
        if (roleName.indexOf(',') > 0) {
            var rolelist = roleName.split(',');
            var element = null, odatastring = '';
            // build up the odata query string
            for (var i = 0; i < rolelist.length; i++) {
                odatastring += "name eq '" + rolelist[i] + "'";
                if (i < rolelist.length - 1) {
                    odatastring += ' or ';
                }
            }
        }
        else {
            // we just have one role to look for
            odatastring = "name eq '" + roleName + "'";
        }
        // Build the odata query string
        var options = "?$select=roleid,name&$filter=" + odatastring;
        var result = Xrm.WebApi.retrieveMultipleRecords("roles", options);


        return result.then(function (d) {

            // Get the user's roles
            var currentUserRoles = Xrm.Utility.getGlobalContext().userSettings.securityRoles;

            for (x = 0; x < d.entities.length; x++) {

                var id = d.entities[x].roleid;

                // Check the returned role id with the user's roles
                for (var j = 0; j < currentUserRoles.length; j++) {
                    var userRole = currentUserRoles[j];
                    if (WF.Util.GuidsAreEqual(userRole, id)) {
                        // User has one of the roles so return true
                        return true;
                    }
                }
            }

            return false;

        }, function (x) {

            if (x.responseText)
                console.error(x.responseText);

            return false;

        });

    },

    GuidsAreEqual: function (guid1, guid2) {
        var isEqual = false;

        if (guid1 == null || guid2 == null) {
            isEqual = false;
        }
        else {
            isEqual = guid1.replace(/[{}]/g, "").toLowerCase() == guid2.replace(/[{}]/g, "").toLowerCase();
        }

        return isEqual;
    },

    pad: function (n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    },

    enableAllFields: function () {
        var attributes = WF.Util.formContext.data.entity.attributes.get();
        for (var i in attributes) {
            WF.Util.formContext.getControl(attributes[i].getName()).setDisabled(false);
        }
    },

    disableAllFields: function () {
        var attributes = WF.Util.formContext.data.entity.attributes.get();
        for (var i in attributes) {
            WF.Util.formContext.getControl(attributes[i].getName()).setDisabled(true);
        }
    },

    doesControlHaveAttribute: function (control) {
        var controlType = control.getControlType();
        return controlType != "iframe" && controlType != "webresource" && controlType != "subgrid";
    },

    disableFormFields: function (onOff) {
        WF.Util.formContext.ui.controls.forEach(function (control, index) {
            if (WF.Util.doesControlHaveAttribute(control)) {
                control.setDisabled(onOff);
            }
        });
    },

    DisableAllControlsInTab: function (tabControlNo) {
        var tabControl = WF.Util.formContext.ui.tabs.get(tabControlNo);
        if (tabControl != null) {
            WF.Util.formContext.ui.controls.forEach
                (
                function (control, index) {
                    if (control.getParent() != null) {
                        if (control.getParent().getParent() == tabControl && control.getControlType() != "subgrid") {
                            control.setDisabled(true);
                        }
                    }
                });
        }
    },

    EnableAllControlsInTab: function (tabControlNo) {
        var tabControl = WF.Util.formContext.ui.tabs.get(tabControlNo);
        if (tabControl != null) {
            WF.Util.formContext.ui.controls.forEach
                (
                function (control, index) {
                    if (control.getParent().getParent() == tabControl && control.getControlType() != "subgrid") {
                        control.setDisabled(false);
                    }
                });
        }
    },

    DisableControlsInSection: function (tabName, sectionName) {
        var tab = WF.Util.formContext.ui.tabs.getByName(tabName);
        if (tab !== undefined && tab !== null) {
            var section = tab.sections.getByName(sectionName);
            if (section !== undefined && section !== null) {
                var controls = section.controls.get();
                if (controls !== undefined && controls !== null && controls.length > 0) {
                    controls.forEach(function (control) {
                        control.setDisabled(true);
                    });
                }
            }
        }
    },

    setFieldRequirementLevelBySection: function (sectionName, requiredLevel) {
        var ctrlName = WF.Util.formContext.ui.controls.get();

        for (var i in ctrlName) {
            var ctrl = ctrlName[i];
            var ctrlSection = ctrl.getParent().getName();

            if (ctrlSection == sectionName) {
                ctrl.getAttribute().setRequiredLevel(requiredLevel);
            }
        }
    },

    getSectionIsDirty: function (sectionName) {
        var ctrlName = WF.Util.formContext.ui.controls.get();

        for (var i in ctrlName) {
            var ctrl = ctrlName[i];
            var ctrlSection = ctrl.getParent().getName();

            if (ctrlSection == sectionName) {
                if (ctrl.getAttribute().getValue() != null)
                    return true;
            }
        }

        return false;
    },

    isDirtyForceSubmit: function (fieldName) {
        try {
            if (!fieldName) {
                var attributes = WF.Util.formContext.data.entity.attributes.get();
                for (var i in attributes) {
                    var attr = attributes[i];
                    var ctrl = WF.Util.formContext.getControl(attr.getName());
                    if (attr.getIsDirty() && ctrl.getDisabled()) {
                        //alert(attr.getName() + " | " + attr.getIsDirty() + " | " + attr.getSubmitMode());
                        attr.setSubmitMode("always");
                    }
                }
            }
            else {
                //  If the field changes, force submitting it
                var field = WF.Util.formContext.getAttribute(fieldName);
                if (field != null) {
                    if (field.getIsDirty())
                        field.setSubmitMode("always");
                }
            }
        }
        catch (ex) {
            alert(ex.message);
        }
    },

    setDefaultValueIfEmpty: function (fieldName, defaultValue) {

        if (WF.Util.formContext.getAttribute(fieldName) && WF.Util.formContext.getAttribute(fieldName).getValue() == null)
            WF.Util.formContext.getAttribute(fieldName).setValue(defaultValue);

    },

    forceSubmitIfDirty: function (fieldName) {
        if (WF.Util.formContext.getAttribute(fieldName) && WF.Util.formContext.getAttribute(fieldName).getIsDirty())
            WF.Util.formContext.getAttribute(fieldName).setSubmitMode("always");

    },


    getSystemConfiguration: function (key) {
        debugger;
        var fetch = "<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false' no-lock='true' count='1'>"
            + "<entity name='wash_systemconfiguration'>"
            + "<attribute name='wash_systemconfigurationid' />"
            + "<attribute name='wash_key' />"
            + "<attribute name='wash_value' />"
            + "<order attribute='wash_key' descending='false' />"
            + "<filter type='and'>"
            + "<condition attribute='wash_key' operator='eq' value='" + key + "' />"
            + "</filter>"
            + "</entity>"
            + "</fetch>";

        return Xrm.WebApi.retrieveMultipleRecords("wash_systemconfiguration", "?fetchXml=" + encodeURIComponent(fetch)).then(function (data) {

            return data.entities[0] && data.entities[0].wash_value ? data.entities[0].wash_value : "";

        });

    },


    thread: function (func) {
        // Render Spin
        var isBusy = false;
        var processor = setInterval(function () {
            if (!isBusy) {
                if (!isBusy) {
                    isBusy = true;
                    var renderSuccess = func();
                    if (renderSuccess) {
                        clearInterval(processor);
                    }
                    isBusy = false;
                }
            }
        },
            250);
    },

    userPositionModifier: function (userId) {
        debugger;
        if (userId === null || userId === undefined)
            userId = Xrm.Utility.getGlobalContext().userSettings != null ? Xrm.Utility.getGlobalContext().userSettings.userId : null;

        return Xrm.WebApi.retrieveRecord("systemuser", userId, "?$select=_wash_positionmodifierid_value")
            .then(function (d) {

                return d;
            });
    },
    //Opportunity type check
    opportunityType: function (oppId) {
        debugger;
        return Xrm.WebApi.retrieveRecord("opportunity", oppId, "?$select=xx_type")
            .then(function (d) {

                return d;
            });
    },
    userRegion: function (userId) {
        debugger;
        if (userId === null || userId === undefined)
            userId = Xrm.Utility.getGlobalContext().userSettings != null ? Xrm.Utility.getGlobalContext().userSettings.userId : null;

        return Xrm.WebApi.retrieveRecord("systemuser", userId, "?$select=_wash_regionid_value")
            .then(function (d) {
                return d;
            });
    },

    positionToNumber: function (position) {
        if (position.startsWith("DSM"))
            return 1;
        else if (position.startsWith("AM"))
            return 1;
        else if (position.startsWith("BD"))
            return 2;
        else if (position.startsWith("RVP"))
            return 3;
        else if (position.startsWith("Exec"))
            return 4;
        else if (position.startsWith("DAG"))
            return 5;
        else
            return -1;
    },

    numberToPosition: function (position) {
        switch (position) {
            case 1:
                return "DSM";
            case 2:
                return "BD";
            case 3:
                return "RVP";
            case 4:
                return "Exec";
            case 5:
                return "DAG";
            default:
                return null;
        }
    },

    setFieldDisabled: function (formContext, field, disabled) {
        formContext.getAttribute(field).controls.forEach(function (control) {
            control.setDisabled(disabled);
        })
    }
}