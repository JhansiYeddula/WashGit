//  L.Wong (Webfortis) 2013.10.16
//  Script for WASH's Net Analysis Entity

if (typeof (WASH) == "undefined") {
    WASH = {};
}

WASH.NetAnalysis = {

    initialSaveInProgress: false,
    USLineOfBusiness: false,
    CANLineOfBusiness: false,
    IsAdministrator: false,
    IsDealApproval: false,
    FiredOnLoad: false,
    CanSave: false,


    onLoad: function (ctx) {
        debugger;
        var formContext = ctx.getFormContext();
        //
        if (typeof console != 'undefined')
            console.log("onLoad()");

        if (WASH.NetAnalysis.initialSaveInProgress == true) {

            WASH.NetAnalysis.initialSaveInProgress = false;

            //unsupported leave for now
            if (typeof (history.pushState) != "undefined") {
                var obj = { Title: formContext.getAttribute("xx_netanalysisname").getValue(), Url: Xrm.Utility.getGlobalContext().getClientUrl() + "/main.aspx?etn=" + formContext.data.entity.getEntityName() + "&pagetype=entityrecord&id=" + encodeURI(formContext.data.entity.getId()) };
                top.history.pushState(obj, obj.Title, obj.Url);
            }
        }

        formContext.getAttribute("xx_opportunitytonetanalysisid").setRequiredLevel("required");

        (WASH.NetAnalysis.FiredOnLoad ? (function () { var def = $.Deferred(); def.resolve("ok"); return def.promise() })() : $.when.apply($, [WF.Util.UserHasRole("Forms - US"), WF.Util.UserHasRole("Forms - Canada"), WF.Util.UserHasRole("System Administrator"), WF.Util.UserHasRole("Deal Approval")])).then(function (us, can, admin, deal) {

            if (!WASH.NetAnalysis.FiredOnLoad) {
                WASH.NetAnalysis.USLineOfBusiness = us;
                WASH.NetAnalysis.CANLineOfBusiness = can;
                WASH.NetAnalysis.IsAdministrator = admin;
                WASH.NetAnalysis.IsDealApproval = deal;
            }

        }, function () {


            formContext.ui.setFormNotification("Error Loading security", "Error", "onload");

        }).always(function () {

            WASH.NetAnalysis.FiredOnLoad = true;

            WASH.NetAnalysis.onLoadPackageOpportunity(ctx);
            WASH.NetAnalysis.onLoadPackageUniversalFields(ctx);
            WASH.NetAnalysis.onLoadSetDefault(ctx);
            WASH.NetAnalysis.lockFields(ctx);
            //this.setDefaultChg(); //  L.Wong 2014.10.02 Comment out as I fixed the feed to ROI workbook
            WASH.NetAnalysis.onLoadStatus(ctx);
            WASH.NetAnalysis.setRentalFieldRequirement(ctx);
            WASH.NetAnalysis.setSlidingScaleFieldRequirement(ctx);


            //prevent dirty form prompt
            setTimeout(function () {
                if (formContext.ui.getFormType() > 1)
                    formContext.data.setFormDirty(false);
            }, 4000);


        });

        Promise.all([WF.Util.UserHasRole("DAG Only"), WF.Util.UserHasRole("System Administrator")])
            .then(function (values) {
                var isDag = values[0];
                var isSysAdmin = values[1];
                if (!isDag && !isSysAdmin) {
                    WF.Util.DisableControlsInSection("tabIncomeInfo", "tab_9_section_1");
                    formContext.getControl("xx_other").setDisabled(false);

                }
            });

        Promise.all([WF.Util.UserHasRole("DAG Only")])
            .then(function (values) {

                var isDag = values[0];
                if (!isDag) {
                    formContext.getControl("xx_percentadjtoannualrev").setDisabled(true);
                    formContext.getControl("xx_laundrimatesnumber").setDisabled(true);
                }
            });

        var oppId = formContext.getAttribute("xx_opportunitytonetanalysisid") != null ? formContext.getAttribute("xx_opportunitytonetanalysisid").getValue() : [];
        var opportunityPromise = null;
        if (oppId != null && oppId.length > 0) {
            opportunityPromise = WF.Util.opportunityType(oppId[0].id);
        }
        else {
            opportunityPromise = Promise.resolve(null);
        }

        Promise.all([WF.Util.userPositionModifier(), opportunityPromise])
            .then(function (values) {
                debugger;
                var positionModifier = values[0];
                var position = positionModifier["_wash_positionmodifierid_value@OData.Community.Display.V1.FormattedValue"];
                var type = values != null && values.length > 1 && values[1] != null ? values[1].xx_type : null;
                if (type == 2 && position != "DAG") {
                    WF.Util.setFieldDisabled(formContext, "xx_forecastedgross", true);
                }

            });

    },

    onSave: function (ctx) {

        var formContext = ctx.getFormContext();

        WASH.NetAnalysis.onSaveSetDefaults(ctx);
        WASH.NetAnalysis.optionCheckPriorSaving(ctx);
        //this.doCalculateTwoPayment(); //  DoneDone #159: Disable 2-payment script, the script is now replaced by the ROI workbook formula
        WASH.NetAnalysis.calculateMANDiff(ctx);
        //this.machineInfoRollup(); //  Disabled due to function migrated into ROI workbook

        //The next 2 commented out lines are for validating the number of card readers against the number of machines
        //
        //if (WASH.NetAnalysis.CanSave) {
        WASH.NetAnalysis.lockFields(ctx);
        //this.setDefaultChg(); //  L.Wong 2014.10.02 Comment out as I fixed the feed to ROI workbook
        WASH.NetAnalysis.setFlatWithGuarantee(ctx);
        //WASH.NetAnalysis.setPercentageAdjtoAnnualRev(ctx); Disabled per Lori - 12/11/2019
        //WASH.NetAnalysis.setFieldsToForceSubmit(ctx);

        //Fix to prevent page from reloading a New Form
        if (formContext.ui.getFormType() == 1 && WASH.NetAnalysis.initialSaveInProgress == false) {
            WASH.NetAnalysis.initialSaveInProgress = true;
        }
        else if (formContext.ui.getFormType() == 1 && formContext.getAttribute("wash_parentnetanalysisid").getValue() != null) {
            WASH.NetAnalysis.initialSaveInProgress = true;
        }

       
    },

    onSaveReload: function (ctx) {

        var formContext = ctx.getFormContext();

        formContext.getControl("xx_status").setDisabled(false);
        WASH.NetAnalysis.onLoad(ctx);
    },

    //  -----------------------------------------
    //
    //  OnLoad ONLY Events
    //
    //  -----------------------------------------
    onLoadSetDefault: function (ctx) {

        var formContext = ctx.getFormContext();

        var formType = formContext.ui.getFormType();
        var aModifiedOn = formContext.getAttribute("modifiedon");

        //  Prod Issue #40 -- Net Analysis ROI section - approved NA
        //  Force the field focus on first field in form so it won't skip/jump to other section on read only form
        formContext.getControl("xx_netanalysisname").setFocus();

        if (formType == 1 && aModifiedOn.getValue() == null) {
            if (formContext.getAttribute("xx_laundrimatesnumber") != null) {
                formContext.getAttribute("xx_laundrimatesnumber").setValue(0);
            }
            if (formContext.getAttribute("xx_numbermachsonlaundryalert") != null) {
                formContext.getAttribute("xx_numbermachsonlaundryalert").setValue(0);
            }

            //  "Clone" function specific changes
            var parentNetAnalysis = formContext.getAttribute("wash_parentnetanalysisid") == null ? null : formContext.getAttribute("wash_parentnetanalysisid").getValue();
            var name = formContext.getAttribute("xx_netanalysisname");
            var status = formContext.getAttribute("xx_status");

            //  Business rule, DoneDone #61 -- Hardcoding Percent Adj to Annual Rev to 0.0075 (0.75%)
            // JM 11/11/2019 - Per Lori, default this field to 0.00 instead of 0.75
            if (formContext.getAttribute("xx_percentadjtoannualrev") != null) {
                var val = formContext.getAttribute("xx_percentadjtoannualrev").getValue();
                if (val == null || val > .75) formContext.getAttribute("xx_percentadjtoannualrev").setValue(parseFloat(0));
            }

            //  Only Clone function would fill this Parent Net Analysis field
            if (parentNetAnalysis != null) {
                if (name != null) name.setValue(name.getValue() + " Copy");
                if (status != null) {
                    if (WASH.NetAnalysis.IsDealApproval) status.setValue(2);
                    else status.setValue(1);
                }
            }
            else {

                Xrm.WebApi.retrieveRecord(
                    "account",
                    formContext.getAttribute("xx_locationlookupid").getValue()[0].id,
                    "$select=wash_lastcontractbonus,wash_lastcontractdate,xx_commissiontype,xx_collectioncycle,xx_mgrallowance,xx_numoflmatealert,xx_propertyname,xx_systemmfg,xx_termsmonths").then(
                        function (wash_location) {

                            var payRuleType = wash_location.xx_commissiontype;
                            var commencementDate = wash_location.wash_lastcontractdate;
                            var bonusDecoPaid = wash_location.wash_lastcontractbonus;
                            var leaseMonth = wash_location.xx_termsmonths;
                            //  L.Wong (Webfortis)
                            var collectionCycle = wash_location.xx_collectioncycle;
                            var mgrAllowance = wash_location.xx_mgrallowance;
                            var propertyName = wash_location.xx_propertyname;
                            var systemMfg = wash_location.xx_systemmfg;

                            var Xx_numofLMateAlert = wash_location.xx_numoflmatealert;

                            commencementDate = commencementDate == "" || commencementDate == null ? "" : new Date(Date.parse(commencementDate));
                            bonusDecoPaid = isNaN(bonusDecoPaid) || bonusDecoPaid == "" || bonusDecoPaid == null ? parseFloat(0) : parseFloat(bonusDecoPaid);
                            leaseMonth = isNaN(leaseMonth) || leaseMonth == "" || leaseMonth == null ? 0 : parseInt(leaseMonth);
                            collectionCycle = isNaN(collectionCycle) || collectionCycle == "" || collectionCycle == null ? 0 : parseInt(collectionCycle);
                            mgrAllowance = isNaN(mgrAllowance) || mgrAllowance == "" || mgrAllowance == null ? 0 : parseFloat(mgrAllowance);

                            Xx_numofLMateAlert = isNaN(Xx_numofLMateAlert) || Xx_numofLMateAlert == "" || Xx_numofLMateAlert == null ? 0 : parseInt(Xx_numofLMateAlert);

                            //alert("Date: " + commencementDate + " | Deco: " + bonusDecoPaid + " | Lease Month: " + leaseMonth);
                            if (formContext.getAttribute("wash_lastcontractbonus") != null) formContext.getAttribute("wash_lastcontractbonus").setValue(bonusDecoPaid);
                            if (formContext.getAttribute("wash_lastcontractdate") != null) formContext.getAttribute("wash_lastcontractdate").setValue(commencementDate);
                            if (formContext.getAttribute("wash_leasetermmo") != null) formContext.getAttribute("wash_leasetermmo").setValue(leaseMonth);
                            if (formContext.getAttribute("xx_commissiontype") != null) formContext.getAttribute("xx_commissiontype").setValue(payRuleType);

                            if (formContext.getAttribute("xx_collectioncycledays") != null) formContext.getAttribute("xx_collectioncycledays").setValue(collectionCycle);
                            if (formContext.getAttribute("xx_managersallowances") != null) formContext.getAttribute("xx_managersallowances").setValue(mgrAllowance);
                            if (formContext.getAttribute("xx_propertyname") != null) formContext.getAttribute("xx_propertyname").setValue(propertyName);
                            //  L.Wong (Webfortis) -- Not using it right now as the optionset description is different between Net Analysis and Location
                            //if (formContext.getAttribute("xx_cardsystem") != null) formContext.getAttribute("xx_cardsystem").setValue(systemMfg);

                            if (formContext.getAttribute("xx_laundrimatesnumber") != null) formContext.getAttribute("xx_laundrimatesnumber").setValue(Xx_numofLMateAlert);

                        }
                    );

            }

            var name = formContext.getAttribute("xx_netanalysisname");

            if (name)
                name.setRequiredLevel("required");

        }

        //alert("US: " + USLineOfBusiness + " | CAN: " + CANLineOfBusiness);
        //  LOB Based Show/Hide Logic; DoneDone #69
        if (WASH.NetAnalysis.USLineOfBusiness) {
            //  Lease Type
            //  1   W Commercial
            //  2   US Rental
            //  3   Contract -Service
            //  4   Contract -Collect
            //  5   Contract -Serv/Coll
            //  6   Calif Apt Assoc
            //  7   Custom
            //  8   MW Commercial
            //  100,000,001 CAD Route
            //  100,000,003 CAD Rental

            if (formContext.getAttribute("xx_leasetype") != null) {
                try {
                    formContext.getControl("xx_leasetype").removeOption(100000001);    //  CAD Route
                    formContext.getControl("xx_leasetype").removeOption(100000003);    //  CAD Rental
                }
                catch (e) {
                }
            }

            //  Pay Rule Type
            //  1   Flat %
            //  2   Flat w/Guar - Hidden for Track 4
            //  3   Overage
            //  4   Sliding Scale
            //  6   Manual
            //  7   Rental
            //  100,000,000 Fixed Amount
            //  100,000,001 Variable Scale
            //  100,000,002 No Payment
            //  100,000,003 Fixed or % WIG  -   New Prior Go-Live 8/19/2014
            //  100,000,004 Fixed Adj to %  -   New Prior Go-Live 8/19/2014

            if (formContext.getAttribute("xx_commissiontype") != null) {
                try {
                    formContext.getControl("xx_commissiontype").removeOption(100000000);    // Fixed Amount
                    formContext.getControl("xx_commissiontype").removeOption(100000001);    // Variable Scale
                    formContext.getControl("xx_commissiontype").removeOption(100000003);    // Fixed or % WIG
                    formContext.getControl("xx_commissiontype").removeOption(100000004);    // Fixed Adj to %
                    if (formContext.getAttribute("xx_commissiontype").getValue() != 2) formContext.getControl("xx_commissiontype").removeOption(2);    //  Flat w/Guar - Hidden for Track 4
                }
                catch (e1) {
                }
            }

            //  Canada Only section
            if (formContext.ui.tabs.get("tabIncomeInfo") != null)
                formContext.ui.tabs.get("tabIncomeInfo").sections.get("secCanadaPayRuleOpts").setVisible(false);
        }

        if (WASH.NetAnalysis.CANLineOfBusiness) {
            //  Lease Type
            //  1   W Commercial
            //  2   US Rental
            //  3   Contract -Service
            //  4   Contract -Collect
            //  5   Contract -Serv/Coll
            //  6   Calif Apt Assoc
            //  7   Custom
            //  8   MW Commercial
            //  100,000,001 CAD Route
            //  100,000,003 CAD Rental

            if (formContext.getAttribute("xx_leasetype") != null) {
                try {
                    formContext.getControl("xx_leasetype").removeOption(6);    //  Calif Apt Assoc
                    formContext.getControl("xx_leasetype").removeOption(8);    //  MW Commercial
                    formContext.getControl("xx_leasetype").removeOption(1);    //  W Commercial
                    formContext.getControl("xx_leasetype").removeOption(2);    //  US Rental
                }
                catch (e2) {
                }
            }

            //  Pay Rule Type
            //  1   Flat %
            //  2   Flat w/Guar - Hidden for Track 4
            //  3   Overage
            //  4   Sliding Scale
            //  6   Manual
            //  7   Rental
            //  100,000,000 Fixed Amount
            //  100,000,001 Variable Scale
            //  100,000,002 No Payment
            //  100,000,003 Fixed or % WIG  -   New Prior Go-Live 8/19/2014
            //  100,000,004 Fixed Adj to %  -   New Prior Go-Live 8/19/2014

            if (formContext.getAttribute("xx_commissiontype") != null) {
                try {
                    formContext.getControl("xx_commissiontype").removeOption(4);    //  Sliding Scale
                    if (formContext.getAttribute("xx_commissiontype").getValue() != 2) formContext.getControl("xx_commissiontype").removeOption(2);    //  Flat w/Guar
                }
                catch (e3) {
                }
            }

            //  Canada Only section
            if (formContext.ui.tabs.get("tabIncomeInfo") != null)
                formContext.ui.tabs.get("tabIncomeInfo").sections.get("secCanadaPayRuleOpts").setVisible(true);
        }

        //  ROI Calculate debug section only for Sys Admins
        if (WASH.NetAnalysis.IsAdministrator) {
            formContext.ui.tabs.get("tabDebug").setVisible(true);
        }

    },
    onLoadPackageOpportunity: function (ctx) {

        var formContext = ctx.getFormContext();

        var pkgOpp = formContext.getAttribute("wash_packageopportunityid");
        var opp = formContext.getAttribute("xx_opportunitytonetanalysisid");
        var option = formContext.getAttribute("wash_option");
        var name = formContext.getAttribute("xx_netanalysisname");
        var aModifiedOn = formContext.getAttribute("modifiedon");

        if (pkgOpp != null) {
            if (pkgOpp.getValue() != null) {
                switch (formContext.ui.getFormType()) {
                    case 1:
                        if (aModifiedOn.getValue() == null) {
                            Xrm.WebApi.retrieveMultipleRecords(
                                "xx_netanalysises",
                                "?$select=xx_netanalysisid,wash_option&$orderby=wash_option asc&$filter=_xx_opportunitytonetanalysisid_value eq '" + formContext.getAttribute("xx_opportunitytonetanalysisid").getValue().replace("{", "").replace("}", "") + "'").then(function (nas) {

                                    var noOfNAs = 0;
                                    for (var i = 0; i < nas.entities.length; i++) {
                                        var currentRec = nas.entities[i];
                                        //alert(currentRec.wash_Option.Value);
                                        if ((i + 1) != currentRec.wash_option) {
                                            noOfNAs = i;
                                            break;
                                        }
                                        else {
                                            noOfNAs = i + 1;
                                        }
                                    }


                                    var option = formContext.getAttribute("wash_option");
                                    var name = formContext.getAttribute("xx_netanalysisname");
                                    var opp = formContext.getAttribute("xx_opportunitytonetanalysisid");
                                    if (option != null) {
                                        //  In case the next option # is bigger than the length of optionset (Out of Range)
                                        if (noOfNAs + 1 > option.getOptions().length - 1) {
                                            WF.Util.setNotification("NA-PkgOpp-E001", 1, "xx_NetAnalysis", "ERROR: Only " + (option.getOptions().length - 1).toString() + " options are allowed for the Opportunity within Package Opportunity. This record cannot be saved.");

                                            //  Disable ALL fields on Form
                                            formContext.ui.controls.forEach(function (control, index) {
                                                control.setDisabled(true);
                                            });

                                            return;
                                        }
                                        else {
                                            option.setValue(noOfNAs + 1);
                                            //formContext.getControl("wash_option").setDisabled(true);

                                            if (name != null) {
                                                if (opp.getValue() != null) {
                                                    name.setValue((formContext.getAttribute("xx_opportunitytonetanalysisid").getValue() ? formContext.getAttribute("xx_opportunitytonetanalysisid").getValue()[0].name : "") + " - Opt" + (noOfNAs + 1));
                                                    //formContext.getControl("xx_netanalysisname").setDisabled(true);
                                                }
                                            }
                                        }
                                    }
                                }
                                );

                        }
                        break;
                    default:
                        break;
                }

                if (formContext.ui.tabs.get("tabPkgOpp") != null) {
                    if (pkgOpp.getValue() != null) {
                        formContext.ui.tabs.get("tabPkgOpp").setFocus();
                    }
                }

                //  Disable Net Analysis's Status for ONLY Pkg Opportunity, this is being managed on Package Level
                if (formContext.getAttribute("xx_status") != null) {
                    formContext.getControl("xx_status").setDisabled(true);
                }
            }
        }
    },

    onLoadStatus: function (ctx) {

        var formContext = ctx.getFormContext();
        var status = formContext.getAttribute("xx_status");

        if (status != null) {
            //var previous = status.getInitialValue();
            var current = status.getValue();
            var ctrl = formContext.getControl("xx_status");
            var options = new Object();
            options = [
                { value: "", text: "" }
                , { value: 1, text: "Not Started" }
                , { value: 2, text: "Submit" }
                , { value: 3, text: "In Progress" }
                , { value: 4, text: "Rejected" }
                , { value: 5, text: "Approved" }
                , { value: 6, text: "Cancelled" }];
            //alert("P: " + previous + " | C:" + current);

            //  1   Not Started
            //  2   Submit
            //  3   In Progress
            //  4   Rejected
            //  5   Approved
            //  6   Cancelled
            switch (current) {
                case null:  //  Empty
                    ctrl.clearOptions();
                    ctrl.addOption(options[1], 1);
                    break;
                case 1: //  Not Started
                    ctrl.clearOptions();
                    ctrl.addOption(options[1], 1);
                    ctrl.addOption(options[2], 2);
                    ctrl.removeOption('');
                    status.setValue(current);
                    break;
                case 2: //  Submit
                    ctrl.clearOptions();
                    ctrl.addOption(options[2], 1);
                    ctrl.addOption(options[3], 2);
                    ctrl.removeOption('');
                    status.setValue(current);
                    break;
                case 3: //  In Progress
                    ctrl.clearOptions();
                    ctrl.addOption(options[3], 1);
                    ctrl.addOption(options[4], 2);
                    //if (WASH.NetAnalysis.IsAdministrator || WASH.NetAnalysis.IsDealApproval) {
                    //    ctrl.addOption(options[5], 3);
                    //}
                    ctrl.removeOption('');
                    status.setValue(current);
                    break;
                case 4: //  Rejected
                    ctrl.clearOptions();
                    ctrl.addOption(options[4], 1);
                    ctrl.removeOption('');
                    status.setValue(current);
                    break;
                case 5: //  Approved
                    ctrl.clearOptions();
                    ctrl.addOption(options[5], 1);
                    ctrl.addOption(options[6], 2);
                    ctrl.removeOption('');
                    status.setValue(current);
                    break;
                case 6: //  Cancelled
                    ctrl.clearOptions();
                    ctrl.addOption(options[6], 1);
                    ctrl.removeOption('');
                    status.setValue(current);
                    break;
                default:
                    ctrl.clearOptions();
                    break;
            }
        }
    },

    onLoadPackageUniversalFields: function (ctx) {

        var formContext = ctx.getFormContext();

        var universalMapping = new Object();
        universalMapping = [
            { source: "wash_1stpercent", target: "xx_firstpercent" }
            , { source: "wash_baserate", target: "xx_baserate" }
            , { source: "wash_baserate2", target: "wash_baserate2" }
            , { source: "wash_billshortfall", target: "wash_billshortfall" }
            , { source: "wash_calculationbasis", target: "wash_calculationbasis" }
            , { source: "wash_calculationfrequency", target: "wash_calculationbasisfrequency" }
            , { source: "wash_changemachinesinxmonths", target: "wash_chgmachinxmths" }
            , { source: "wash_fixedamount", target: "wash_flatamount" }
            , { source: "wash_leasetermmos", target: "xx_leaseterms" }
            , { source: "wash_leasetype", target: "xx_leasetype" }
            , { source: "wash_machchgtype", target: "wash_machchgtype" }
            , { source: "wash_mincomppmpd", target: "wash_monthlyminimum" }
            , { source: "wash_paymentfrequency", target: "wash_paymentfreq" }
            , { source: "wash_paymenttype", target: "wash_paymenttype" }
            , { source: "wash_payruletype", target: "xx_commissiontype" }
            , { source: "wash_percentafterbase", target: "xx_percentafterbase" }
            , { source: "wash_percentafterbase2", target: "wash_percentageoverbase2" }
            , { source: "wash_reconciliationfrequency", target: "wash_reconfreq" }
            , { source: "wash_revenuetype", target: "wash_revenuetype" }
            , { source: "wash_targetroi", target: "wash_targetroi" }
            , { source: "wash_use100afterbase", target: "xx_use1useonehundredpercent00" }
        ];
    },

    //  -----------------------------------------
    //
    //  OnSave ONLY Events
    //
    //  -----------------------------------------

    optionCheckPriorSaving: function (ctx) {

        var formContext = ctx.getFormContext();
        var pkgOpp = formContext.getAttribute("wash_packageopportunityid");
        var option = formContext.getAttribute("wash_option");

        if (pkgOpp != null && option != null) {
            if (pkgOpp.getValue() != null && option.getValue() == null) {
                event.returnValue = false;
            }
        }
    },

    //  Hookup Event: WASH.NetAnalysis.ROIWorkbook.js, ribbonCalculationTrigger
    calculateMANDiff: function (ctx) {

        var formContext = typeof ctx.getAttribute === "function" ? ctx : ctx.getFormContext();

        var absoluteNet = formContext.getAttribute("xx_absolutenet");
        var minAbsoluteNet = formContext.getAttribute("xx_minabsolutenet");
        var MANDiffer = formContext.getAttribute("wash_mandiffdeal");
        var MANDifferPerc = formContext.getAttribute("wash_mandiffpercdeal");

        if (absoluteNet != null && minAbsoluteNet != null && MANDiffer != null && MANDifferPerc != null) {
            var MANVal = minAbsoluteNet.getValue() == null ? 0 : minAbsoluteNet.getValue();
            var ANVal = absoluteNet.getValue() == null ? 0 : absoluteNet.getValue();
            var MANDifferPercVal = 0;

            //  MAN Diff % Calculations
            if (MANVal != 0) MANDifferPercVal = ((ANVal - MANVal) / MANVal) * 100;

            MANDiffer.setValue(ANVal - MANVal);
            MANDifferPerc.setValue(ANVal == MANVal || MANVal == 0 ? 0 : MANDifferPercVal);
        }
    },

    ShowAlert: function (ctx) {
        //debugger;
        //var isModelIpuZero = WASH.Ribbon.IsModelIPUZero(ctx);
        //if (isModelIpuZero === true) {
        //    alert("Model $ IPU = $0.00 due to Bedroom Count = 0. Update Location Record, then recalculate.");
        //}
    },

    setFlatWithGuarantee: function (ctx) {

        var formContext = ctx.getFormContext();

        var payRuleType = formContext.getAttribute("xx_commissiontype");
        var payRuleTypeCtrl = formContext.getControl("xx_commissiontype");
        var minComp = formContext.getAttribute("wash_monthlyminimum");
        var status = formContext.getAttribute("xx_status");

        if (!WASH.NetAnalysis.CANLineOfBusiness) {
            if (payRuleType != null && minComp != null && status != null) {
                var payRuleVal = payRuleType.getValue();
                var minCompVal = minComp.getValue();
                var statusVal = status.getValue();

                //  Change "Flat" to "Flat w/Guar" on "Approval" status if Min Comp > 0
                if (payRuleVal == 1 && minCompVal > 0 && statusVal == 5) {
                    var opt = new Option();
                    opt.value = 2;
                    opt.text = "Flat w/Guar";

                    payRuleTypeCtrl.addOption(opt);
                    payRuleType.setValue(2);
                    payRuleType.setSubmitMode("always");
                }
            }
        }
    },

    setPercentageAdjtoAnnualRev: function (ctx) {

        var formContext = ctx.getFormContext();
        var cutoffDate = new Date("8/24/2014");
        var today = new Date();
        var percAdjAnnualRev = formContext.getAttribute("xx_percentadjtoannualrev");
        var createdOn = formContext.getAttribute("createdon");

        if (percAdjAnnualRev != null && createdOn != null) {
            if (createdOn.getValue() != null) {
                if (createdOn.getValue().getTime() > cutoffDate.getTime() && percAdjAnnualRev.getValue() > .75) {
                    WF.Util.setNotification("NA-E01", 1, "xx_NetAnalysis", "ERROR: Percentage Adj to Annual Rev cannot be greater than 0.75.");
                    //formContext.getAttribute("xx_percentadjtoannualrev").setValue();
                    event.returnValue = false;
                }
            }
        }
        else {
            //  Clean out Notifications
            WF.Util.setNotification(null, -1, null, null);
        }
    },

    setFieldsToForceSubmit: function (ctx) {

        var formContext = ctx.getFormContext();

        var readOnlyFields = [
            "xx_absolutenet"    //  Absolute Net
            , "xx_capexbonusdeco"   //  Bonus/Deco Cap Ex
            , "xx_capexequipment"   //  Equipment Cap Ex
            , "xx_commissionpercent"    //  Effective Commission %
            , "xx_commpermach"  //  Comm Per Mach
            , "xx_commpermach"  //  Comm Per Mach
            , "xx_forecastedgross"    //  Forecasted Gross
            , "xx_grosspermach" //  Gross Per Mach
            , "xx_lastcalculated"    //  Last Calculated
            , "xx_machinecost"  //  Bonus per Mach
            , "xx_minabsolutenet"   //  Min Absolute Net
            , "xx_netbeforebonus"    //  Net per Mach
            , "xx_percentadjtooh"    //  Percent Adj to OH
            , "xx_proposedbonus" //  Approved Bonus
            , "xx_roi"  //  Deal ROI
            , "xx_totalcapex"   //  Total Cap Ex
            , "xx_totalmachines"    //  Total Machines
            , "xx_totalwasherdryerprice"    //  Total W/D Price
            , "xx_unitcost" //  Bonus per Unit
            , "wash_mandiffdeal"    //  MAN Diff $ (Deal)
            , "wash_mandiffpercdeal"    //  MAN Diff % (Deal)
            , "xx_cardsystem2"  //  New 2015.03.11
            , "wash_monthlywirelessfeesoverterm"  //  New 2015.03.11
            , "wash_wirelessdatafees"  //  New 2015.03.11
        ];

        for (var i = 0; i < readOnlyFields.length; i++) {
            WF.Util.forceSubmitIfDirty(readOnlyFields[i]);
        }
    },

    onSaveSetDefaults: function (ctx) {

        var formContext = ctx.getFormContext();
        //  L.Wong (Webfortis) 2014.10.01
        //  Replace xx_netanalysis_main_library.js, SetDefaultvalues function
        WF.Util.setDefaultValueIfEmpty("xx_collectioncycledays", 30);
        WF.Util.setDefaultValueIfEmpty("xx_forecastedgross", 25);
        WF.Util.setDefaultValueIfEmpty("xx_percentadjtooh", 100);

        WF.Util.setDefaultValueIfEmpty("xx_numbermachsonlaundryalert", 0);
        WF.Util.setDefaultValueIfEmpty("xx_codenondispensing", 0);
        WF.Util.setDefaultValueIfEmpty("xx_combosnumber", 0);
        WF.Util.setDefaultValueIfEmpty("xx_earlychangeoutcharge", 0);
        WF.Util.setDefaultValueIfEmpty("xx_extramachinecount", 0);

        WF.Util.setDefaultValueIfEmpty("xx_laundrimatesnumber", 0);
        WF.Util.setDefaultValueIfEmpty("xx_numberofcreditcsu", 0);
        WF.Util.setDefaultValueIfEmpty("xx_numberofcreditcash1boxcsu", 0);
        WF.Util.setDefaultValueIfEmpty("xx_numberofcardreaders", 0);
        WF.Util.setDefaultValueIfEmpty("xx_numberofcards", 0);

        WF.Util.setDefaultValueIfEmpty("xx_othercosts", 0);
        WF.Util.setDefaultValueIfEmpty("xx_managersallowances", 0);
        WF.Util.setDefaultValueIfEmpty("xx_decorationcost", 0);
        WF.Util.setDefaultValueIfEmpty("xx_miscother", 0);
        WF.Util.setDefaultValueIfEmpty("xx_valueofmach", 0);

        WF.Util.setDefaultValueIfEmpty("xx_amountpaid", 0);
        WF.Util.setDefaultValueIfEmpty("xx_usagepercentchange", 0);
        WF.Util.setDefaultValueIfEmpty("xx_firstpercent", 0);
        WF.Util.setDefaultValueIfEmpty("xx_baserate", 0);
        WF.Util.setDefaultValueIfEmpty("xx_percentafterbase", 0);

        WF.Util.setDefaultValueIfEmpty("xx_leaseterms", 0);
        WF.Util.setDefaultValueIfEmpty("xx_monthsleftonweblease", 0);
        WF.Util.setDefaultValueIfEmpty("xx_leasestarts", 0);
        WF.Util.setDefaultValueIfEmpty("xx_actualtargetnet", 0);
        WF.Util.setDefaultValueIfEmpty("xx_actualtargetnet", 0);

        WF.Util.setDefaultValueIfEmpty("xx_estimatedreportedgross", 0);
        WF.Util.setDefaultValueIfEmpty("xx_proposedbonus", 0);
        WF.Util.setDefaultValueIfEmpty("xx_othercosts2", 0);
    },

    //  -----------------------------------------
    //
    //  Other Events
    //
    //  -----------------------------------------

    //  Hookup OnChange Event: xx_proposedbonus
    doCalculateTwoPayment: function (ctx) {

        var formContext = ctx.getFormContext();

        var TwoPayment1stBonus = formContext.getAttribute("wash_twopayment1stbonus");
        var TwoPayment2ndBonus = formContext.getAttribute("wash_twopayment2ndbonus");
        var proposedBonus = formContext.getAttribute("xx_proposedbonus");

        if (proposedBonus != null && TwoPayment1stBonus != null & TwoPayment2ndBonus != null) {
            //  DoneDone #159: Change the calculation to ROI sheet, whenever xx_proposedbonus changes, wipe out the two-payment fields
            //var propsedBonusVal = proposedBonus.getValue() == null ? 0 : proposedBonus.getValue();

            //TwoPayment1stBonus.setValue(propsedBonusVal * 0.5);
            //TwoPayment2ndBonus.setValue(propsedBonusVal * 0.5 * 1.15);

            //TwoPayment1stBonus.setSubmitMode("always");
            //TwoPayment2ndBonus.setSubmitMode("always");

            TwoPayment1stBonus.setValue();
            TwoPayment2ndBonus.setValue();
        }
    },

    clearRoiFields: function (ctx) {

        var formContext = ctx.getFormContext();

        var fieldsToBeCleared = [
            "wash_accountmgrapproval",
            "wash_base1totalmonthlydollars",
            "wash_base2totalmonthlydollars",
            "wash_dsmapproval",
            "wash_effectivecommission",
            "wash_lease1stpercent",
            "wash_leasebaserate1",
            "wash_leasebaserate1frequency",
            "wash_leasebaserate2",
            "wash_leasebaserate2frequency",
            "wash_leasepercentafterbase1",
            "wash_leasepercentafterbase2",
            "wash_minabsnet12",
            "wash_splitbonustotal",
            "wash_suggestedmonth",
            "wash_totalofannualpymts",
            "wash_totalofmonthlypymts",
            "wash_totalupfrontexpenses2",
            "wash_twopayment1stbonus",
            "wash_twopayment2ndbonus",
            "xx_absolutenet",
            "xx_air",
            "xx_amortization",
            "xx_annualbonus",
            "xx_capexbonusdeco",
            "xx_capexequipment",
            "xx_cardsystem2",
            "xx_commissionpercent",
            "xx_commpermach",
            "xx_computedmonthsleft",
            "xx_computednewgross",
            "xx_computedusagechg",
            "xx_cyclesmaday",
            "xx_excesspaid",
            "xx_forecastednewgross",
            "xx_forcastedunitcost",
            "xx_geographicnet",
            "xx_grosspermach",
            "xx_interest",
            "xx_machinecost",
            "xx_maxdollarsavailable",
            "xx_minabsolutenet",
            "xx_minimunrequirednet",
            "xx_mintargetroi",
            "xx_modelunitcost",
            "xx_monthlybonus",
            "xx_monthsgained",
            "xx_netafterbonus",
            "xx_netbeforebonus",
            "xx_pricechange",
            "xx_pvplusminusrentcharge",
            "xx_roi",
            "xx_suggestedchange",
            "xx_targetnetbonus",
            "xx_total",
            "xx_totalcapex",
            "xx_totalmachinecost",
            "xx_totalmachines",
            "xx_totalmiscmonthly",
            "xx_totalwasherdryerprice",
            "xx_unitcost",
            "xx_version"
        ];

        for (var i = 0; i < fieldsToBeCleared.length; i++) {
            var field = formContext.getAttribute(fieldsToBeCleared[i]);
            if (field != null) field.setValue();
        }

        formContext.getAttribute("wash_calculated").setValue(false);

        formContext.ui.refreshRibbon();
    },

    lockFields: function (ctx) {

        var formContext = ctx.getFormContext();
        var status = formContext.getAttribute("xx_status").getValue();

        if (status != 5 && status != 6) {
            return;
        }

        var fields = formContext.ui.controls.get();

        for (var i in fields) {
            var field = fields[i];
            if (field.getParent() != null) {
                var sectionName = field.getParent().getName();
                if (sectionName != "tab_10_section_2") {
                    try {
                        field.setDisabled(true);
                    }
                    catch (err) { }
                }
            }
        }

        //document.getElementById("GridCardSystem" + "_span").disabled = "true";
        //document.getElementById("GridCombo" + "_span").disabled = "true";
        //document.getElementById("GridWasher" + "_span").disabled = "true";
        //document.getElementById("GridDryer" + "_span").disabled = "true";

        formContext.getAttribute("xx_status").setSubmitMode("always");
    },

    //  L.Wong (Webfortis) 2015.04.01
    //  Part of Package Deal requirement: Page 3, bullet point #4. Force selected fields under the "Rental Information" Section to Required if Pay Rule = Rental
    //  Hookup OnChange Event: xx_commissiontype (Pay Rule Type); OnLoad event
    setRentalFieldRequirement: function (ctx) {

        var formContext = ctx.getFormContext();

        var payRuleType = formContext.getAttribute("xx_commissiontype");

        if (payRuleType != null) {
            //  7   Rental
            if (payRuleType.getValue() == 7) {

                Xrm.WebApi.retrieveRecord("account",
                    formContext.getAttribute("xx_locationlookupid").getValue()[0].id,
                    "$select=accountid,wash_company").then(function (wash_location) {

                        switch (wash_location.wash_company) {
                            case 100000000:
                            case 100000001:
                                if (formContext.getAttribute("xx_totalrent") != null) formContext.getAttribute("xx_totalrent").setRequiredLevel("recommended");
                                if (formContext.getAttribute("xx_washerrentpmpm") != null) formContext.getAttribute("xx_washerrentpmpm").setRequiredLevel("required");
                                if (formContext.getAttribute("xx_dryerrentpmpm") != null) formContext.getAttribute("xx_dryerrentpmpm").setRequiredLevel("required");
                                if (formContext.getAttribute("xx_stackrentpmpm") != null) formContext.getAttribute("xx_stackrentpmpm").setRequiredLevel("required");
                                break;
                            case 100000003:
                            case 100000005:
                                if (formContext.getAttribute("xx_totalrent") != null) formContext.getAttribute("xx_totalrent").setRequiredLevel("required");
                                if (formContext.getAttribute("xx_washerrentpmpm") != null) formContext.getAttribute("xx_washerrentpmpm").setRequiredLevel("recommended");
                                if (formContext.getAttribute("xx_dryerrentpmpm") != null) formContext.getAttribute("xx_dryerrentpmpm").setRequiredLevel("recommended");
                                if (formContext.getAttribute("xx_stackrentpmpm") != null) formContext.getAttribute("xx_stackrentpmpm").setRequiredLevel("recommended");
                                break;
                            default:
                                if (formContext.getAttribute("xx_totalrent") != null) formContext.getAttribute("xx_totalrent").setRequiredLevel("recommended");
                                if (formContext.getAttribute("xx_washerrentpmpm") != null) formContext.getAttribute("xx_washerrentpmpm").setRequiredLevel("recommended");
                                if (formContext.getAttribute("xx_dryerrentpmpm") != null) formContext.getAttribute("xx_dryerrentpmpm").setRequiredLevel("recommended");
                                if (formContext.getAttribute("xx_stackrentpmpm") != null) formContext.getAttribute("xx_stackrentpmpm").setRequiredLevel("recommended");
                                break;
                        }
                    });

            }
            else {
                if (formContext.getAttribute("xx_totalrent") != null) formContext.getAttribute("xx_totalrent").setRequiredLevel("recommended");
                if (formContext.getAttribute("xx_washerrentpmpm") != null) formContext.getAttribute("xx_washerrentpmpm").setRequiredLevel("recommended");
                if (formContext.getAttribute("xx_dryerrentpmpm") != null) formContext.getAttribute("xx_dryerrentpmpm").setRequiredLevel("recommended");
                if (formContext.getAttribute("xx_stackrentpmpm") != null) formContext.getAttribute("xx_stackrentpmpm").setRequiredLevel("recommended");
            }
        }
    },

    //  L.Wong (Webfortis) 2015.04.03
    //  Part of Package Deal extended requirement, derivation from Rental Field Required Field (Added in 4/2/2015 meeting). 
    //  Force selected fields under the "Sliding Scale - US Only" Section to Required if Pay Rule = Sliding Scale
    //  Hookup OnChange Event: xx_commissiontype (Pay Rule Type); OnLoad event
    setSlidingScaleFieldRequirement: function (ctx) {

        var formContext = ctx.getFormContext();

        var payRuleType = formContext.getAttribute("xx_commissiontype");

        if (payRuleType != null) {
            //  4   Sliding Scale
            if (payRuleType.getValue() == 4) {
                if (formContext.getAttribute("xx_ss1stpercent") != null) formContext.getAttribute("xx_ss1stpercent").setRequiredLevel("required");
                if (formContext.getAttribute("xx_ss2ndpercent") != null) formContext.getAttribute("xx_ss2ndpercent").setRequiredLevel("required");
                if (formContext.getAttribute("xx_baseamountpm1") != null) formContext.getAttribute("xx_baseamountpm1").setRequiredLevel("required");
                if (formContext.getAttribute("xx_baseamountpm2") != null) formContext.getAttribute("xx_baseamountpm2").setRequiredLevel("required");
            }
            else {
                if (formContext.getAttribute("xx_ss1stpercent") != null) formContext.getAttribute("xx_ss1stpercent").setRequiredLevel("recommended");
                if (formContext.getAttribute("xx_ss2ndpercent") != null) formContext.getAttribute("xx_ss2ndpercent").setRequiredLevel("recommended");
                if (formContext.getAttribute("xx_baseamountpm1") != null) formContext.getAttribute("xx_baseamountpm1").setRequiredLevel("recommended");
                if (formContext.getAttribute("xx_baseamountpm2") != null) formContext.getAttribute("xx_baseamountpm2").setRequiredLevel("recommended");
            }
        }
    },

    //  L.Wong (Webfortis) 2015.04.03
    //  Add-on requirement after 4/2/2015 meeting.
    //  Force selected fields under the "Sliding Scale - US Only" Section to Required if Pay Rule = Sliding Scale when approving Net Analysis
    //  Hookup OnChange Event: xx_status (Status); OnLoad event
    setStatusRequiredFields: function (ctx) {

        var formContext = ctx.getFormContext();
        var status = formContext.getAttribute("xx_status");

        if (status != null) {
            //  5   Approved
            if (status.getValue() == 5) {
                var payRuleType = formContext.getAttribute("xx_commissiontype");

                if (payRuleType != null) {
                    //  4   Sliding Scale
                    if (payRuleType.getValue() == 4) {
                        //if (formContext.getAttribute("xx_baserate") != null) formContext.getAttribute("xx_baserate").setRequiredLevel("required");
                        //if (formContext.getAttribute("xx_percentafterbase") != null) formContext.getAttribute("xx_percentafterbase").setRequiredLevel("required");
                        //if (formContext.getAttribute("wash_baserate2") != null) formContext.getAttribute("wash_baserate2").setRequiredLevel("required");
                    }
                    else {
                        if (formContext.getAttribute("xx_baserate") != null) formContext.getAttribute("xx_baserate").setRequiredLevel("recommended");
                        if (formContext.getAttribute("xx_percentafterbase") != null) formContext.getAttribute("xx_percentafterbase").setRequiredLevel("recommended");
                        if (formContext.getAttribute("wash_baserate2") != null) formContext.getAttribute("wash_baserate2").setRequiredLevel("recommended");
                    }
                }
            }
            else {
                if (formContext.getAttribute("xx_baserate") != null) formContext.getAttribute("xx_baserate").setRequiredLevel("recommended");
                if (formContext.getAttribute("xx_percentafterbase") != null) formContext.getAttribute("xx_percentafterbase").setRequiredLevel("recommended");
                if (formContext.getAttribute("wash_baserate2") != null) formContext.getAttribute("wash_baserate2").setRequiredLevel("recommended");
            }
        }
    },

    //  NOT IN USE
    //  Fixed ROI Sheet feeding to "" instead of 0 if the field is emptied
    setDefaultChg: function (ctx) {

        var formContext = ctx.getFormContext();

        var chg_mach = formContext.getAttribute("wash_chgmachinxmths");

        if (chg_mach != null) {
            var value = chg_mach.getValue();

            if (value != null) {
                return;
            }

            chg_mach.setValue(999);
        }
    },

    isCardSystemValid: function (ctx) {
        var formContext = ctx.getFormContext();

        var id = formContext.data.entity.getId();
        if (id === undefined || id === null || id === "") {
            return Promise.resolve({
                isValid: true
            });
        }
        var cardSystemPromise = Xrm.WebApi.retrieveMultipleRecords("wash_cardsystems", "$filter=_wash_netanalysisid_value eq " + id + "&$select=wash_type,wash_condition,wash_qty");
        var washerPromise = Xrm.WebApi.retrieveMultipleRecords("wash_washers", "$filter=_wash_netanalysisid_value eq " + id + "&$select=wash_condition,wash_qty");
        var dryerPromise = Xrm.WebApi.retrieveMultipleRecords("wash_dryers", "$filter=_wash_netanalysisid_value eq " + id + "&$select=wash_condition,wash_qty,wash_type");
        var comboPromise = Xrm.WebApi.retrieveMultipleRecords("wash_combos", "$filter=_wash_netanalysisid_value eq " + id + "&$select=wash_condition,wash_qty");

        return Promise.all([cardSystemPromise, washerPromise, dryerPromise, comboPromise])
            .then(function (values) {
                var cardSystems = values != null && values.length > 0 ? values[0].entities : [];
                var washers = values != null && values.length > 1 ? values[1].entities : [];
                var dryers = values != null && values.length > 2 ? values[2].entities : [];
                var combos = values != null && values.length > 3 ? values[3].entities : [];


                var newUsedMachines = 0;
                var machines = 0;

                const newUsedConditions = [286910000, 1, 2, 100000006, 100000007, 3, 100000008, 6];
                washers.forEach(function (machine) {
                    if (newUsedConditions.indexOf(machine.wash_condition) >= 0)
                        newUsedMachines += machine.wash_qty != null ? machine.wash_qty : 0;

                    machines += machine.wash_qty != null ? machine.wash_qty : 0;
                });
                dryers.forEach(function (machine) {
                    var mult = machine.wash_type === 2 ? 2 : 1;
                    if (newUsedConditions.indexOf(machine.wash_condition) >= 0)
                        newUsedMachines += machine.wash_qty != null ? machine.wash_qty * mult : 0;
                    machines += (machine.wash_qty != null ? machine.wash_qty : 0) * mult;
                });
                combos.forEach(function (machine) {
                    if (newUsedConditions.indexOf(machine.wash_condition) >= 0)
                        newUsedMachines += machine.wash_qty != null ? machine.wash_qty * 2 : 0;

                    machines += (machine.wash_qty != null ? machine.wash_qty : 0) * 2;
                });

                var mobileReaders = 0;
                cardSystems.forEach(function (system) {
                    //Mobile, Mobile - Non-Connected Room, Mobile - Connected Room
                    if (system.wash_type === 100000007 || system.wash_type === 100000008 || system.wash_type === 100000009)
                        mobileReaders += system.wash_qty != null ? system.wash_qty : 0;
                });



                var wirelessReaders = formContext.getAttribute("xx_numberwirelessreaders") != null && formContext.getAttribute("xx_numberwirelessreaders").getValue() != null ? formContext.getAttribute("xx_numberwirelessreaders").getValue() : 0;
                var readers = formContext.getAttribute("xx_numberofcardreaders") != null && formContext.getAttribute("xx_numberofcardreaders").getValue() != null ? formContext.getAttribute("xx_numberofcardreaders").getValue() : 0;

                //Wireless readers is not 0 and does not match number of new/used machines
                if (wirelessReaders !== 0 && wirelessReaders !== newUsedMachines) {
                    return {
                        isValid: false,
                        error: "Wireless Readers"
                    };
                }
                //Mobile readers is not 0 and does not match total number of machines
                else if (mobileReaders !== 0 && mobileReaders !== machines) {
                    return {
                        isValid: false,
                        error: "Mobile Readers"
                    };
                }
                //Readers is not 0 and does not match number of new/used machines
                else if (readers !== 0 && readers !== newUsedMachines) {
                    return {
                        isValid: false,
                        error: "Card Readers"
                    };
                }
                else {
                    return {
                        isValid: true
                    };
                }
            });
    }
}

WASH.Ribbon = {
    approvalNotificationId: "approvalNotificaiton",
    canCancel: null,
    canCalculate: null,
    canApprove: null,
    updateApprovalPromise: null,
    updateModelCheckPromise: null,
    isZero: false,
    escalation: null,
    escalationReason: null,


    CancelEnableCheck: function (ctx) {


        $.when.apply($, [WF.Util.UserHasRole("System Administrator"), WF.Util.UserHasRole("Deal Approval")]).then(function (IsAdministrator, IsDealApproval) {

            var Enable = IsAdministrator || IsDealApproval;

            if (ctx.getAttribute("xx_status") != null) {
                if (ctx.getAttribute("xx_status").getValue() != 5) //  5   Approved
                    Enable = false;
            }
            return Enable;

        }).then(function (e) {


            if (e !== WASH.Ribbon.canCancel) {
                WASH.Ribbon.canCancel = e;
                ctx.ui.refreshRibbon();
            }

        });

        return WASH.Ribbon.canCancel;
    },

    RibbonOnClickCancel: function (ctx) {
        var status = ctx.getAttribute("xx_status");

        if (status == null) {
            alert("STATUS cannot be found on form. Please contact your CRM Administrator. CANCEL APPROVAL abort.");
        }
        else {
            if (confirm("You are about to CANCEL this APPROVED Net Analysis. Are you sure?")) {
                status.setValue(6); //  6   Cancelled
                status.setSubmitMode("always");
                ctx.data.entity.save();
            }
        }
    },

    CalculateEnableCheck: function (ctx) {

        var status = ctx.getAttribute("xx_status");


        $.when.apply($, [WF.Util.UserHasRole("System Administrator"),
        WF.Util.UserHasRole("District Sales Managers"),
        WF.Util.UserHasRole("Sales Support"),
        WF.Util.UserHasRole("Deal Approval")]).then(function (IsAdministrator, IsDSM, IsSalesSupport, IsDealApproval) {


            //if (!isIE) return false;
            if (IsAdministrator) {

                return true;
            };

            if (status != null) {
                switch (status.getValue()) {
                    case 1:
                        if (IsDSM || IsSalesSupport) return true;
                        else return false;
                        break;
                    case 2:
                    case 3:
                        if (IsDealApproval) true;
                        else return false;
                        break;
                    case 4:
                    case 5:
                    case 6:
                        return false;
                        break;
                    default:
                        return false;
                        break;
                }
            }
        }).then(function (e) {


            if (e !== WASH.Ribbon.canCalculate) {
                WASH.Ribbon.canCalculate = e;
                ctx.ui.refreshRibbon();
            }

        });

        return WASH.Ribbon.canCalculate;
    },

    RibbonOnClickClone: function (ctx) {

        try {
            if (confirm("Do you want to clone this record?")) {
                var parentId = ctx.data.entity.getId().replace('{', '').replace('}', '');

                var parameters = {};
                parameters["_CreateFromId"] = "{" + parentId + "}";
                parameters["_CreateFromType"] = Xrm.Internal.getEntityCode("xx_netanalysis");
                parameters["etc"] = Xrm.Internal.getEntityCode("xx_netanalysis");
                parameters["pagetype"] = "entityrecord";

                //upgraded
                Xrm.Navigation.openForm(parameters).then(
                    function (success) {
                        console.log(success);
                    },
                    function (error) {
                        console.log(error);
                    });
            }
        }
        catch (ex) {
            alert(ex.description);
        }
    },

    OnClickApprove: function (ctx) {
        var formContext = ctx.getFormContext();
        debugger;
        //var formContext = this.readXML(ctx);
        //approved

        formContext.getAttribute("xx_status").setValue(5);
        formContext.getAttribute("wash_approver").setValue(Xrm.Utility.getGlobalContext().userSettings != null ? Xrm.Utility.getGlobalContext().userSettings.userName : null);
        formContext.getAttribute("wash_approvedon").setValue(new Date());

        formContext.data.entity.save();
    },
    getFormContextForRibbon: function (executionContext) {
        var formContext = null;
        if (executionContext !== null) {
            if (typeof executionContext.getAttribute === 'function') {
                formContext = executionContext; //most likely called from the ribbon.
            } else if (typeof executionContext.getFormContext === 'function'
                && typeof (executionContext.getFormContext()).getAttribute === 'function') {
                formContext = executionContext.getFormContext(); // most likely called from the form via a handler
            } else {
                throw 'formContext was not found'; 
            }
        }
        return formContext;
    },
    OnClickRequestApproval: function (ctx) {
        var Id = ctx.data.entity.getId().replace('{', '').replace('}', '');

        var target = {};
        target.entityType = ctx.data.entity.getEntityName();
        target.id = Id;

        var req = {};

        req.entity = target;

        if (WASH.Ribbon.escalation === 5) {
            req.getMetadata = function () {
                return {
                    boundParameter: "entity",
                    parameterTypes: {
                        entity: {
                            typeName: "mscrm.xx_netanalysis",
                            structuralProperty: 5
                        },
                    },
                    operationType: 0,
                    operationName: "wash_DAGEscalation"
                };
            };
        }
        else {
            req.Approval_Tier = WASH.Ribbon.escalation;

            req.getMetadata = function () {
                return {
                    boundParameter: "entity",
                    parameterTypes: {
                        entity: {
                            typeName: "mscrm.xx_netanalysis",
                            structuralProperty: 5
                        },
                        Approval_Tier: {
                            typeName: "Edm.Integer",
                            structuralProperty: 1
                        }
                    },
                    operationType: 0,
                    operationName: "wash_TierEscalation"
                };
            };
        }

        return Xrm.WebApi.online.execute(req)
            .then(
                function (data) {

                    if (data.status === 204) {
                        var message = "Requested approval from " + WF.Util.numberToPosition(WASH.Ribbon.escalation);
                        alert(message);
                    }
                    console.log(data);
                }
            )
            .fail(function (result) {
                console.log(result);
                alert("Request approval has failed");
            });
    },

    HasCalculated: function (ctx) {
        return (ctx.getFormContext().getAttribute('wash_calculated') != null ? ctx.getFormContext().getAttribute('wash_calculated').getValue() : false) === true;
    },

    IsValidStatus: function (ctx) {
        //In progress
        return (ctx.getFormContext().getAttribute("xx_status") != null ? ctx.getFormContext().getAttribute("xx_status").getValue() : false) === 3;
    },
    //Added for user story CRMO-170

    IsModelIPUZero: function (ctx) {
        debugger;
        var formContext = ctx.getFormContext();
        var modelIpu = formContext.getAttribute("xx_modelunitcost") != null ? formContext.getAttribute("xx_modelunitcost").getValue() : null;
        var oppId = formContext.getAttribute("xx_opportunitytonetanalysisid") != null ? formContext.getAttribute("xx_opportunitytonetanalysisid").getValue() : [];
        var opportunityPromise = null;
        if (oppId != null && oppId.length > 0) {
            opportunityPromise = WF.Util.opportunityType(oppId[0].id);
        }
        else {
            opportunityPromise = Promise.resolve(null);
        }

        var id = formContext.data.entity.getId();
        Promise.all([opportunityPromise])
            .then(function (values) {
                debugger;
                var type = values != null && values.length > 0 && values[0] != null ? values[0].xx_type : null;
                var popup = false;
                if (type == 1 && modelIpu == 0) {
                    popup = true;

                }

                return popup;
            })
            .then(function (e) {

                debugger;
                if (e !== WASH.Ribbon.isZero) {
                    WASH.Ribbon.isZero = e;
                    alert("Model $ IPU = $0.00 due to Bedroom Count = 0. Update Location Record, then recalculate.");
                }

            });


        return WASH.Ribbon.isZero;
    },



    ApproveEnableCheck: function (ctx) {
        debugger;
        var hasCalculated = WASH.Ribbon.HasCalculated(ctx);
        var isValidStatus = WASH.Ribbon.IsValidStatus(ctx);
        var isModelIpuZero = WASH.Ribbon.IsModelIPUZero(ctx);
        if ((WASH.Ribbon.updateApprovalPromise === null || WASH.Ribbon.updateApprovalPromise === undefined) && hasCalculated && isValidStatus)

            WASH.Ribbon.updateApprovalPromise = WASH.Ribbon.UpdateApprovalButtonEnable(ctx);

        return hasCalculated && WASH.Ribbon.canApprove !== null && WASH.Ribbon.canApprove && isModelIpuZero != null && !isModelIpuZero;
    },

    RequestApprovalEnableCheck: function (ctx) {
        debugger;
        var hasCalculated = WASH.Ribbon.HasCalculated(ctx);
        var isValidStatus = WASH.Ribbon.IsValidStatus(ctx);

        var isModelIpuZero = WASH.Ribbon.IsModelIPUZero(ctx);
        return hasCalculated && WASH.Ribbon.canApprove !== null && !WASH.Ribbon.canApprove && isModelIpuZero != null && !isModelIpuZero;

    },

    UpdateApprovalButtonEnable: function (ctx) {
        debugger;
        var formContext = ctx.getFormContext();

        var locationPromise = null;
        var location = formContext.getAttribute("xx_locationlookupid") != null ? formContext.getAttribute("xx_locationlookupid").getValue() : [];
        if (location.length > 0) {
            locationPromise = Xrm.WebApi.retrieveRecord("accounts", location[0].id, "$select=xx_totalhookups");
        }
        else {
            locationPromise = Promise.resolve(null);
        }

        var owner = formContext.getAttribute("ownerid") != null ? formContext.getAttribute("ownerid").getValue() : [];
        var ownerPromise = null;
        if (owner.length > 0) {
            ownerPromise = WF.Util.userRegion(owner[0].id);
        }
        else {
            ownerPromise = Promise.resolve(null);
        }

        var oppId = formContext.getAttribute("xx_opportunitytonetanalysisid") != null ? formContext.getAttribute("xx_opportunitytonetanalysisid").getValue() : [];
        var opportunityPromise = null;
        if (oppId != null && oppId.length > 0) {
            opportunityPromise = WF.Util.opportunityType(oppId[0].id);
        }
        else {
            opportunityPromise = Promise.resolve(null);
        }

        var id = formContext.data.entity.getId();
        var washerPromise = Xrm.WebApi.retrieveMultipleRecords("wash_washers", "$filter=_wash_netanalysisid_value eq " + id + "&$select=wash_condition");

        return Promise.all([WF.Util.userPositionModifier(), locationPromise, ownerPromise, washerPromise, opportunityPromise])
            .then(function (values) {
                debugger;
                var positionModifier = values[0];
                var location = values[1];
                var owner = values[2];
                var washers = values != null && values.length > 3 && values[3] != null ? values[3].entities : [];

                var position = positionModifier["_wash_positionmodifierid_value@OData.Community.Display.V1.FormattedValue"];
                var regionId = owner["_wash_regionid_value@OData.Community.Display.V1.FormattedValue"];

                var type = values != null && values.length > 4 && values[4] != null ? values[4].xx_type : null;

                //User has no position modifier and cannot self approve
                if (position === null || position === undefined || regionId === null || regionId === undefined) {
                    return false;
                }

                if (position === "DAG") {
                    return true;
                }

                if (formContext.getAttribute('wash_packagenetanalysisid') != null && formContext.getAttribute('wash_packagenetanalysisid').getValue() != null) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Package Net Analysis";

                    return false;
                }

                var payRuleType = formContext.getAttribute('xx_commissiontype') != null ? formContext.getAttribute('xx_commissiontype').getValue() : null;
                //Flat, Flat w/ Guar, Overage or Rental
                if (payRuleType != 1 && payRuleType != 2 && payRuleType != 3 && payRuleType != 7) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Pay Rule Type";

                    return false;
                }

                var leaseType = formContext.getAttribute('xx_leasetype') != null ? formContext.getAttribute('xx_leasetype').getValue() : null;
                //W Commercial, MW Commercial, CAD Route,US Rental or CAD Rental
                if (leaseType != 1 && leaseType != 8 && leaseType != 100000001 && leaseType != 2 && leaseType != 100000003) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Lease Type";

                    return false;
                }

                var forcastedIpu = formContext.getAttribute("xx_forcastedunitcost") != null ? formContext.getAttribute("xx_forcastedunitcost").getValue() : null;
                var modelIpu = formContext.getAttribute("xx_modelunitcost") != null ? formContext.getAttribute("xx_modelunitcost").getValue() : null;

                if (payRuleType != 7 && forcastedIpu !== null && modelIpu !== null && forcastedIpu > modelIpu && type == 1) {
                    debugger;
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Forecasted IPU is more than Model IPU"
                    return false;

                }

                if (payRuleType == 7) {
                    if (forcastedIpu !== null && modelIpu !== null && forcastedIpu < modelIpu) {
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                        WASH.Ribbon.escalationReason = "Forecasted IPU is less than Model IPU";
                        return false;
                    }
                }


                var deductCcFees = formContext.getAttribute("xx_deductwirelessfeesfromcommission") != null ? formContext.getAttribute("xx_deductwirelessfeesfromcommission").getValue() : null;
                //None
                if (deductCcFees === 3) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Deduct CC Fees From"

                    return false;
                }

                if (location === null || location["xx_totalhookups"] === null || location["xx_totalhookups"] > 0) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Hookups is more than 0"

                    return false;
                }

                var washerConditions = washers.map(function (washer) { return (washer != null ? washer.wash_condition : null); });
                var changeMachine = formContext.getAttribute("wash_chgmachinxmths") != null ? formContext.getAttribute("wash_chgmachinxmths").getValue() : null;
                var suggestedMonth = formContext.getAttribute("wash_suggestedmonth") != null ? formContext.getAttribute("wash_suggestedmonth").getValue() : null;
                var cyclesMachDay = formContext.getAttribute("xx_cyclesmaday") != null ? formContext.getAttribute("xx_cyclesmaday").getValue() : null;
                //new
                debugger;
                if (washerConditions.indexOf(286910000) >= 0
                    || washerConditions.indexOf(1) >= 0
                    || washerConditions.indexOf(2) >= 0
                    || washerConditions.indexOf(100000006) >= 0
                    || washerConditions.indexOf(100000007) >= 0
                    || washerConditions.indexOf(3) >= 0
                    || washerConditions.indexOf(100000008) >= 0) {
                    debugger;
                    //
                    //if (changeMachine !== 85) {
                    //    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    //    WASH.Ribbon.escalationReason = "Change Machine in X Months is not 85"

                    //    WF.Util.setFieldDisabled(formContext, "wash_suggestedmonth", true);
                    //    WF.Util.setFieldDisabled(formContext, "xx_cyclesmaday", true);

                    //    return false;
                    //}

                    if (cyclesMachDay >= 2.5 && suggestedMonth == 85 && position != "DAG") {
                        debugger;
                        WF.Util.setFieldDisabled(formContext, "wash_chgmachinxmths", true);

                    }
                }

                //Used
                if (washerConditions.indexOf(6) >= 0) {
                    var leaseTerm = formContext.getAttribute("xx_leaseterms") != null ? formContext.getAttribute("xx_leaseterms").getValue() : null;
                    debugger;
                    if (changeMachine != null && changeMachine > leaseTerm && cyclesMachDay > 1.5) {
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                        WASH.Ribbon.escalationReason = "Chg Mach in X Mos is greater than lease term"
                        return false;
                    }
                }
                //Existing
                if (washerConditions.indexOf(5) >= 0
                    || washerConditions.indexOf(100000002) >= 0
                    || washerConditions.indexOf(4) >= 0
                    || washerConditions.indexOf(100000003) >= 0
                    || washerConditions.indexOf(100000004) >= 0
                    || washerConditions.indexOf(100000005) >= 0) {
                    debugger;
                    if (changeMachine != null && suggestedMonth != null && changeMachine != suggestedMonth) {
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                        WASH.Ribbon.escalationReason = "Chg Mach in X Mos is not equal to Suggested Mach Chg Mo"
                        return false;
                    }
                }

                var otherMachCost = formContext.getAttribute("wash_othermachcosts") != null ? formContext.getAttribute("wash_othermachcosts").getValue() : null;
                if (otherMachCost < 0) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Other Mach Costs is less than 0"
                    return false;
                }

                var otherFutureCost = formContext.getAttribute("wash_otherchgcosts") != null ? formContext.getAttribute("wash_otherchgcosts").getValue() : null;
                if (otherFutureCost < 0) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Other Future Costs is less than 0"
                    return false;
                }

                var otherCardSystemCost = formContext.getAttribute("xx_othercosts2") != null ? formContext.getAttribute("xx_othercosts2").getValue() : null;
                if (otherCardSystemCost < 0) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Other Card System Costs is less than 0"
                    return false;
                }

                var otherMonthly = formContext.getAttribute("xx_othercosts") != null ? formContext.getAttribute("xx_othercosts").getValue() : null;
                if (otherMonthly < 0) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Other Monthly is less than 0"
                    return false;
                }

                var otherMisc = formContext.getAttribute("xx_miscother") != null ? formContext.getAttribute("xx_miscother").getValue() : null;
                if (otherMisc < 0) {
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Other Misc is less than 0"
                    return false;
                }

                var geographicNet = formContext.getAttribute("xx_geographicnet") != null ? formContext.getAttribute("xx_geographicnet").getValue() : null;
                if (geographicNet > 6) {
                    debugger;
                    WASH.Ribbon.escalation = WF.Util.positionToNumber("DAG");
                    WASH.Ribbon.escalationReason = "Geographic Net is greater than 6"
                    return false;
                }

                if (!position.startsWith("RVP")) {

                    if (geographicNet > 4 && geographicNet <= 6) {
                        debugger;
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("RVP");
                        WASH.Ribbon.escalationReason = "Geographic Net is greater than 4 or less than or equal to 6"
                        return false;
                    }

                    var proposedBonus = formContext.getAttribute("xx_proposedbonus") != null ? formContext.getAttribute("xx_proposedbonus").getValue() : null;
                    var maxBonus = formContext.getAttribute("xx_maxdollarsavailable") != null ? formContext.getAttribute("xx_maxdollarsavailable").getValue() : null;
                    if (proposedBonus !== 0 && proposedBonus > maxBonus) {
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("RVP");
                        WASH.Ribbon.escalationReason = "Proposed Bonus is more than Max Bonus";

                        return false;
                    }

                    var leaseTerm = formContext.getAttribute("xx_leaseterms") != null ? formContext.getAttribute("xx_leaseterms").getValue() : null;
                    if (leaseTerm < 60 || leaseTerm > 120) {
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("RVP");
                        WASH.Ribbon.escalationReason = "Lease Term is less than 60 or more than 120";

                        return false;
                    }

                    var monthsLeft = formContext.getAttribute("xx_monthsleftonweblease") != null ? formContext.getAttribute("xx_monthsleftonweblease").getValue() : null;
                    var computedMonthsLeft = formContext.getAttribute("xx_computedmonthsleft") != null ? formContext.getAttribute("xx_computedmonthsleft").getValue() : null;
                    if (monthsLeft !== null && monthsLeft !== computedMonthsLeft) {
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("RVP");
                        WASH.Ribbon.escalationReason = "Months Left does not equal Computed Months Left";

                        return false;
                    }

                    var otherMachCost = formContext.getAttribute("wash_othermachcosts") != null && formContext.getAttribute("wash_othermachcosts").getValue() != null ? formContext.getAttribute("wash_othermachcosts").getValue() : 0;
                    if (otherMachCost === null || otherMachCost < 0) {
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("RVP");
                        WASH.Ribbon.escalationReason = "Other Mach Costs is less than zero";

                        return false;
                    }

                    var minComp = formContext.getAttribute("wash_monthlyminimum") != null && formContext.getAttribute("wash_monthlyminimum").getValue() != null ? formContext.getAttribute("wash_monthlyminimum").getValue() : 0;
                    var netPerMach = formContext.getAttribute("xx_netbeforebonus") != null && formContext.getAttribute("xx_netbeforebonus").getValue() != null ? formContext.getAttribute("xx_netbeforebonus").getValue() : 0;
                    if (minComp !== 0 && minComp * 30 < netPerMach * .9) {
                        WASH.Ribbon.escalation = WF.Util.positionToNumber("RVP");
                        WASH.Ribbon.escalationReason = "Min Comp or Net Per Machine does not calculate"

                        return false;
                    }
                }

                Xrm.WebApi.retrieveMultipleRecords("wash_dealapprovalmatrixsettings", "$filter=wash_region eq '" + regionId + "'")
                    .then(function (matricies) {
                        if (matricies.entities.length === 0) {
                            return;
                        }

                        var matrix = matricies.entities[0];
                        WASH.Ribbon.CallApprovalAction(matrix, formContext)
                            .then(function (result) {


                                if (WF.Util.positionToNumber(position) >= result.escalation) {
                                    return true;
                                }
                                else {
                                    WASH.Ribbon.escalation = result.escalation;
                                    WASH.Ribbon.escalationReason = result.escalationReason;
                                    return false;
                                }
                            })
                            .then(function (canApprove) {
                                WASH.Ribbon.HandleCanApprove(canApprove, ctx);
                            });
                    });

                return null;
            })
            .then(function (canApprove) {
                if (canApprove !== null)
                    WASH.Ribbon.HandleCanApprove(canApprove, ctx);
            });
    },

    HandleCanApprove: function (canApprove, ctx) {
        if (canApprove === false) {
            ctx.ui.setFormNotification("Not available for self approval: " + WASH.Ribbon.escalationReason, "INFO", WASH.Ribbon.approvalNotificationId);
        }
        else {
            ctx.ui.clearFormNotification(WASH.Ribbon.approvalNotificationId);
        }

        if (WASH.Ribbon.canApprove !== canApprove) {
            WASH.Ribbon.canApprove = canApprove;
            ctx.ui.refreshRibbon();
        }
        setTimeout(function () {
            WASH.Ribbon.updateApprovalPromise = null;
        }, 500);
    },

    CallApprovalAction: function (approvalMatrix,formContext) {
        const decimalMetadata = {
            typeName: "Edm.Decimal",
            structuralProperty: 1
        };

        var Id = formContext.data.entity.getId().replace('{', '').replace('}', '');

        var target = {};
        target.entityType = formContext.data.entity.getEntityName();
        target.id = Id;

        var req = {};

        req.BPM_DSM = approvalMatrix["wash_bpm_dsm"];
        req.BPM_BD = approvalMatrix["wash_bpm_bd"];
        req.BPM_RVP = approvalMatrix["wash_bpm_rvp"];
        req.EC_DSM = approvalMatrix["wash_effcomm_dsm"];
        req.EC_BD = approvalMatrix["wash_effcomm_bd"];
        req.EC_RVP = approvalMatrix["wash_effcomm_rvp"];
        req.GPM_DSM = approvalMatrix["wash_collectiondays_dsm"];
        req.GPM_BD = approvalMatrix["wash_collectiondays_bd"];
        req.GPM_RVP = approvalMatrix["wash_collectiondays_rvp"];
        req.ROI_DSM = approvalMatrix["wash_roi_dsm"];
        req.ROI_BD = approvalMatrix["wash_roi_bd"];
        req.ROI_RVP = approvalMatrix["wash_roi_rvp"];
        req.NAC_DSM = approvalMatrix["wash_nac_dsm"];
        req.NAC_BD = approvalMatrix["wash_nac_bd"];
        req.NAC_RVP = approvalMatrix["wash_nac_rvp"];

        req.entity = target;
        req.getMetadata = function () {
            return {
                boundParameter: "entity",
                parameterTypes: {
                    entity: {
                        typeName: "mscrm.xx_netanalysis",
                        structuralProperty: 5
                    },
                    BPM_DSM: decimalMetadata,
                    BPM_BD: decimalMetadata,
                    BPM_RVP: decimalMetadata,
                    EC_DSM: decimalMetadata,
                    EC_BD: decimalMetadata,
                    EC_RVP: decimalMetadata,
                    GPM_DSM: decimalMetadata,
                    GPM_BD: decimalMetadata,
                    GPM_RVP: decimalMetadata,
                    ROI_DSM: decimalMetadata,
                    ROI_BD: decimalMetadata,
                    ROI_RVP: decimalMetadata,
                    NAC_DSM: decimalMetadata,
                    NAC_BD: decimalMetadata,
                    NAC_RVP: decimalMetadata
                },
                operationType: 0,
                operationName: "wash_NetAnalysisApprovalAction"
            };
        };

        return Xrm.WebApi.online.execute(req).then(
            function (data) {
                var e = JSON.parse(data.responseText);


                return {
                    escalation: e.Approval_Tier,
                    escalationReason: e.Failed_Check
                };
            }
        );
    }
}