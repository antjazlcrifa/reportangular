

import { Component, Input , ViewChild, OnChanges, SimpleChanges} from '@angular/core';
import { BreakpointObserver, Breakpoints, BreakpointState } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { ActionsService } from '../services/actions.service';
import { BVMobileAppApiService } from '../services/bvmobileappapi.service';
import { FormDataService } from '../services/form-data.service';
import { CustomMsalService } from '../services/msal/msal.service';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';
import { Subject, forkJoin } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import * as pbi from 'powerbi-client';
import { environment } from 'src/environments/environment';
import { DatePipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VisualContainerDisplayMode } from 'powerbi-models';
import { Papa } from 'ngx-papaparse';
import { form } from '../models/Form/form';
import { page } from '../models/Form/page';
import { section } from '../models/Form/section';
import { row } from '../models/Form/row';
import { column } from '../models/Form/column';
import { control, lookupcontrol, filescontrol } from '../models/Form/control';
import { WorkspaceService } from '../services/workspace.service';
import { Action } from 'rxjs/internal/scheduler/Action';
import { report } from 'process';
import { filter } from 'rxjs/operators';
import 'powerbi-report-authoring';
import { resolveAny } from 'dns';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { FormInstanceDialogComponent, FormDialogComponent } from '../form/form.component';
import isSameDay from 'date-fns/fp/isSameDay';



@Component({
    selector: 'report',
    templateUrl: './report.component.html',
    styleUrls: ['./report.component.css']
})
export class ReportComponent  implements OnChanges {
    siteId: number;

    helper: JwtHelperService = new JwtHelperService();
    @Input() layout = 0;
    @Input() embedded = false;
    @Input() reportId: string;
    @Input() pageId: string;
    @Input() asOfDate: any;
    @Input() messageId: any;
    @Input() filtersEnabled = true;
    quickActionSubscription: any;
    secondaryQuickActionSubscription: any;
    reportfields: any = [];
    currentData: any[] = [];
    pages: any[];
    interval: any;
    popupopened: boolean = false;
    bookmark: any = {};
    applybookmark = true;
    isNew = false;
    @ViewChild('pbireport', { static: true }) reportcontainer;
    isHandset: Observable<BreakpointState> = this.breakpointObserver.observe(Breakpoints.Handset);
    constructor(public snackBar: MatSnackBar, public dialog: MatDialog, private workspaceService: WorkspaceService, private adalService: CustomMsalService, private sanitizer: DomSanitizer, private datePipe: DatePipe, public actionsservice: ActionsService, private breakpointObserver: BreakpointObserver, private bottomSheet: MatBottomSheet, public reportService: BVMobileAppApiService, private router: Router, private route: ActivatedRoute, private ngxCsvParser: Papa, protected formdataservice: FormDataService) {
        this.formdataservice.data = null;
    }

    private report: pbi.Report;
    ngOnChanges(changes: SimpleChanges) {
        debugger
        if (changes.filtersEnabled != null && changes.filtersEnabled.previousValue != changes.filtersEnabled.currentValue) {
            if (this.report != null) {
                const newSettings: pbi.models.ISettings = {

                    filterPaneEnabled: changes.filtersEnabled.currentValue
                };

                this.report.updateSettings(newSettings);
            }

        } else if (changes.layout != null && changes.layout.previousValue != changes.layout.currentValue) {
            if (this.report != null) {
                const newSettings: pbi.models.ISettings = {

                    layoutType: changes.layout.currentValue
                };

                this.report.updateSettings(newSettings);
            }

        }
    }
    updateReportSettings() {
        if (this.report && this.report.iframe && this.report.iframe.contentWindow) {
            this.report.updateSettings(this.getLayoutSetting());

        }
    }
    ngOnInit() {
        this.breakpointObserver.observe(Breakpoints.Handset).subscribe(x => {
            this.updateReportSettings();
        });
        this.breakpointObserver.observe(Breakpoints.HandsetLandscape).subscribe(x => {
            this.updateReportSettings();
        });

        this.breakpointObserver.observe(Breakpoints.HandsetPortrait).subscribe(x => {
            this.updateReportSettings();
        });
        this.actionsservice.setTitle('');
        // this.actionsservice.title = "Reports";
        this.secondaryQuickActionSubscription = this.actionsservice.getSecondaryQuickActionTriggeredEmitter()
            .subscribe(action => {
                if (action.actionname = 'addreportitem') {
                    this.addItem();
                }
            });
        this.quickActionSubscription = this.actionsservice.getQuickActionTriggeredEmitter()
            .subscribe(action => {
                if (action.actionname == 'refreshreport') {
                    this.refresh();
                } else if (action.actionname == 'savebookmark') {
                    this.savebookmark();
                } else if (action.actionname == 'removebookmark') {
                    this.removebookmark();
                } else if (action.actionname == 'editreportdata') {
                    this.loadreportdata(action.parameter, this.editreportdata, action.actionparameter, false, action.passdata, action.keys);

                } else if (action.actionname == 'navigateto') {
                    this.loadreportdata(action.parameter, this.navigateto, action.actionparameter, false, action.passdata, action.keys);

                }
                else if (action.actionname == 'addtolist') {
                    this.loadreportdata(action.parameter, this.addToList, action.actionparameter, true, action.passdata, action.keyw);
                }
                else if (action.actionname == 'navigatetobasic') {
                    this.navigatetobasic(this, action.parameter.detail.dataPoints[0], action.actionparameter, action.savestate);
                }
            });

        this.route.paramMap.subscribe((params: ParamMap) => {
            if (!this.embedded) {
                this.actionsservice.quickaction = { 'name': 'Refresh', 'icon': 'refresh', 'action': 'refreshreport' };
                this.actionsservice.hasactions = true;
            }
            this.isNew = params.has('isNew') ? JSON.parse(params.get('isNew').valueOf()) : false;
            this.loadreport(params.has('customerId') ? params.get('customerId') : null, params.has('siteId') ? params.get('siteId') : null, params.has('branchId') ? params.get('branchId') : null, params.has('jobId') ? params.get('jobId') : null, params.has('job') ? params.get('job') : null, params.has('assetId') ? params.get('assetId') : null, params.has('employeeId') ? params.get('employeeId') : null, params.has('vendor') ? params.get('vendor') : null, params.has('po') ? params.get('po') : null, (this.reportId ? this.reportId : params.get('reportId')), (this.pageId ? this.pageId : params.get('pageId')), (this.asOfDate ? this.asOfDate : params.get('asOfDate')), (this.messageId ? this.messageId : params.get('messageId')));
        });



    }

    ngOnDestroy() {
        this.actionsservice.bookmarked = false;
        if (this.quickActionSubscription != null) {
            this.quickActionSubscription.unsubscribe();
        }
        if (this.secondaryQuickActionSubscription != null) {
            this.secondaryQuickActionSubscription.unsubscribe();
        }
    }

    public loadreport(customerId, siteId, branchId, jobId, job, assetId, employeeId,vendor,po, reportId: any, pageId: any, asOfDate: any, messageId: any) {

        if (messageId != null) {
            this.reportService.getReportSubscriptionMessage(messageId).subscribe(x => {
                this.applybookmark = false;
                this.loadreportinternal(customerId, siteId, branchId, jobId, job, assetId, employeeId, vendor,po, reportId, x.PageId, asOfDate, messageId,x.Data);
            });
        }
        else {
            this.loadreportinternal(customerId, siteId, branchId, jobId, job, assetId, employeeId, vendor,po, reportId, pageId, asOfDate, messageId,null);
        }
    }

    public loadreportinternal(customerId, siteId, branchId, jobId, job, assetId, employeeId, vendor,po, reportId: any, pageId: any, asOfDate: any, messageId: any, reportLevelFilter: any) {
        const existingreport: any = this.reportService.reports.filter(x => x.id == reportId);
        if (existingreport.length == 1) {
            const report = existingreport[0];
            this.showreport(customerId, siteId, branchId, jobId, job, assetId, employeeId, vendor,po, report.embedUrl, report.id, pageId, asOfDate, reportLevelFilter);
        } else {

            return this.reportService.getReports().subscribe((reports) => {
                const report = reports.value.filter(r => r.id == reportId)[0];
                this.reportService.reports.push(report);
                this.showreport(customerId, siteId, branchId, jobId, job, assetId, employeeId, vendor,po, report.embedUrl, report.id, pageId, asOfDate, reportLevelFilter);
            });


        }
    }

    private getLayoutSetting() {
        const newSettings = {
            layoutType: this.layout != 0 ? this.layout : ( !this.breakpointObserver.isMatched(Breakpoints.Handset) ? 0 : (this.breakpointObserver.isMatched(Breakpoints.HandsetLandscape) ? 3 : 2))
        };

        return newSettings;
    }
    private dataselected(data: any, reportId: any) {
        debugger
        if (!this.popupopened) {
            if (data.detail.visual.type.indexOf('calendarVisual') != -1 || data.detail.visual.type == 'pivotTable' || data.detail.visual.type == 'tableEx' /*&& this.reportfields.filter(field => field.Page == data.detail.page.name).length != 0*/) {
                if (data.detail.dataPoints == null || data.detail.dataPoints.length == 0) {
                    this.datapointselected = {};
                    this.actionsservice.quickaction = { 'name': 'Refresh', 'icon': 'refresh', 'action': 'refreshreport' };
                } else {


                    const workspacereport: any = this.workspaceService.currentWorkspace.reports.filter(x => x.Id == reportId);
                    if (workspacereport.length != 0) {
                        this.actionsservice.quickaction.passdata = true;
                        const reportpage = workspacereport[0].pages.filter(x => x.Id == data.detail.page.name);

                        if (reportpage.length != 0 && reportpage[0].editaction != null && !reportpage[0].editaction.multiselect) {
                            if (reportpage[0].editaction.name == 'showforminstance') {
                                this.showforminstance(data.detail.dataPoints[0], reportpage[0].editaction.parameter);
                            }
                            else if (reportpage[0].editaction.name == 'showform') {
                                this.showform(data.detail.dataPoints[0], reportpage[0].editaction.parameter, reportpage[0].editaction.keys);
                            }
                            else {
                                this.actionsservice.quickaction = { 'name': reportpage[0].editaction.title, 'icon': reportpage[0].editaction.icon, 'action': reportpage[0].editaction.name, 'actionparameter': reportpage[0].editaction.parameter, 'parameter': data, 'multiselect': reportpage[0].editaction.multiselect, "passdata": reportpage[0].editaction.passdata != null ? reportpage[0].editaction.passdata : false, "savestate": reportpage[0].editaction.savestate, "keys": reportpage[0].editaction.keys };
                            }
                        }
                        else {
                            if (reportpage[0].editaction.name == 'showforminstance') {
                                this.showform(data.detail.dataPoints[0], reportpage[0].editaction.parameter, reportpage[0].editaction.keys);
                            }
                            else if (reportpage[0].editaction.name == 'showform') {
                                this.showforminstance(data.detail.dataPoints[0], reportpage[0].editaction.parameter);
                            }
                            else {
                                this.actionsservice.quickaction.multiselect = reportpage[0].editaction.multiselect;

                                this.actionsservice.quickaction.passdata = reportpage[0].editaction.passdata != null ? reportpage[0].editaction.passdata : true;
                                this.actionsservice.quickaction.actionparameter = reportpage[0].editaction.parameter;
                                this.actionsservice.quickaction.parameter = data;
                                this.actionsservice.quickaction.savestate = reportpage[0].editaction.savestate;
                                this.actionsservice.quickaction.newname = reportpage[0].editaction.title;
                                this.actionsservice.quickaction.newicon = reportpage[0].editaction.icon;
                                this.actionsservice.quickaction.newaction = reportpage[0].editaction.name;
                                this.actionsservice.quickaction.newkeys = reportpage[0].editaction.keys;
                            }


                        }
                    }
                }
                if (this.actionsservice.quickaction.multiselect) {
                    this.actionsservice.secondaryquickaction = { actionname: 'addreportitem', icon: 'add', data: this.currentData.length > 0 ? this.currentData.length - 1 : 0 };
                }
                else {
                    this.actionsservice.secondaryquickaction = null;
                }
            }
        }


    }
    public showreport(customerId: any, siteId: any, branchId: any, jobId: any, job: any, assetId: any, employeeId: any,vendor: any,po: any, embedUrl: any, reportId: any, pageId: any, asOfDate: any, reportLevelFilter: any) {
    debugger
        this.reportService.getReportFields(reportId).subscribe(reportfields => {
            this.reportfields = reportfields;
            this.adalService.getToken(['https://analysis.windows.net/powerbi/api/Report.Read.All']).then(token => {
                const filters: any[] = [];
                const tokenAuth: any = token;
               
                if (siteId != null) {
                    const siteIdFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'Site',
                            column: 'Id'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: siteId
                            }

                        ],
                        filterType: 0
                    };
                    filters.push(siteIdFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (customerId != null) {
                    const customerIdFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'Customer',
                            column: 'Id'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: customerId
                            }

                        ],
                        filterType: 0
                    };
                    filters.push(customerIdFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (assetId != null) {
                    const assetIdFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'Asset',
                            column: 'Id'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: assetId
                            }

                        ],
                        filterType: 0
                    };
                    filters.push(assetIdFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (employeeId != null) {
                    const employeeIdFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'Employee',
                            column: 'Employee'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: employeeId
                            }

                        ],
                        filterType: 0,

                    };
                    filters.push(employeeIdFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (branchId != null) {
                    const branchIdFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'Branch',
                            column: 'Id'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: branchId
                            }

                        ],
                        filterType: 0
                    };

                    filters.push(branchIdFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (jobId != null) {
                    const jobIdFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'Job',
                            column: 'Id'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: jobId
                            }

                        ],
                        filterType: 0
                    };
                    filters.push(jobIdFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (job != null) {
                    const jobFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'Jobs',
                            column: 'Job'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: job
                            }

                        ],
                        filterType: 0
                    };
                    filters.push(jobFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (vendor != null) {
                    const vendorFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'PurchaseOrders',
                            column: 'Vendor'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: vendor
                            }

                        ],
                        filterType: 0
                    };
                    filters.push(vendorFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (po != null) {
                    const poFilter: any = {
                        $schema: 'http://powerbi.com/product/schema#advanced',
                        target: {
                            table: 'PurchaseOrdersRealTime',
                            column: 'PO'
                        },
                        logicalOperator: 'And',
                        conditions: [
                            {
                                operator: 'Is',
                                value: po
                            }

                        ],
                        filterType: 0
                    };
                    filters.push(poFilter);
                    this.applybookmark = false;
                    this.actionsservice.allowback = true;
                }

                if (asOfDate != null) {
                    if (asOfDate != 0) {
                        this.asOfDate = new Date(parseInt(asOfDate));
                    } else {
                        this.interval = setInterval(() => {
                            this.refresh();
                            // this.refresh(); // api call
                        }, 30 * 1000);
                    }
                    this.filtersEnabled = false;
                    this.actionsservice.allowback = true;



                }

                const config: pbi.IEmbedConfiguration = {
                    type: 'report',
                    tokenType: 0,
                    accessToken: token,
                    embedUrl: embedUrl + (reportLevelFilter != null ? '&filter=' + reportLevelFilter : ''),
                    id: reportId,
                    filters: filters,
                    permissions: 0,
                    viewMode: 0,

                    pageName: pageId,
                    settings: {
                        visualRenderedEvents: true,
                        filterPaneEnabled: this.filtersEnabled,
                        navContentPaneEnabled: true,
                        layoutType: this.getLayoutSetting().layoutType



                    }
                };

                // Grab the reference to the div HTML element that will host the report.
                // let reportContainer = <HTMLElement>document.getElementById('pbi-report');

                // Embed the report and display it within the div container.

                const currentTime = Date.now();
                const expiration = this.helper.getTokenExpirationDate(token).getTime();
                const safetyInterval = 2 * 60 * 1000;

                const timeout = expiration - currentTime - safetyInterval;
                const powerbi: pbi.service.Service = new pbi.service.Service(pbi.factories.hpmFactory, pbi.factories.wpmpFactory, pbi.factories.routerFactory);
                powerbi.reset(this.reportcontainer.nativeElement);
                this.report = <pbi.Report>powerbi.embed(this.reportcontainer.nativeElement, config);
                this.report.on("bookmarkApplied", (event) => {
                });
                this.report.on('dataSelected', (data: any) => {
                    this.dataselected(data, reportId);
                });

                this.report.on('loaded', () => {
                    this.actionsservice.setTitle('Report');
                    if (this.applybookmark) {
                        const bookmarks = this.reportService.getReportBookmarks(this.report.getId()).subscribe((x: any[]) => {
                            if (x.length != 0) {
                                this.bookmark = x[0];
                                this.actionsservice.bookmarked = true;
                                this.report.bookmarksManager.applyState(this.bookmark.State);

                            }

                            //if (this.actionsservice.bookmarks[this.report.getId()] != null)
                            //    this.report.bookmarksManager.applyState(this.actionsservice.bookmarks[this.report.getId()].state);
                            //else
                            //    this.report.bookmarksManager.applyState(this.bookmark.State);
                        });
                    }
                    if (this.report && this.report.iframe && this.report.iframe.contentWindow) {
                        if (timeout <= 0) {
                            this.refreshtoken();
                        } else {
                            this.interval = setTimeout(() => {
                                this.refreshtoken();
                                // this.refresh(); // api call
                            }, timeout);

                        }

                        this.report.getFilters().then((x: any) => {
                            if (this.asOfDate != null && this.asOfDate != 0) {
                                let filters = x.filter(x => x.target.table == 'AsOfDateCalendar' && x.target.column == 'AsOfDate');
                                if (filters.length != 0) {
                                    filters[0].filterType = 1;
                                    filters[0].operator = 'In';
                                    filters[0].values = [this.datePipe.transform(this.asOfDate, 'yyyy-MM-ddT00:00:00.000')];

                                } else {
                                    const asOfDateFilter: any = {
                                        $schema: 'http://powerbi.com/product/schema#advanced',
                                        target: {
                                            table: 'AsOfDateCalendar',
                                            column: 'AsOfDate'
                                        },
                                        operator: 'In',
                                        logicalOperator: 'And',
                                        values: [this.datePipe.transform(this.asOfDate, 'yyyy-MM-ddT00:00:00.000')],
                                        filterType: 1
                                    };
                                    x.push(asOfDateFilter);
                                }
                                filters = x.filter(x => x.target.table == 'AsOfDateCalendar' && x.target.column == 'Days From Now');
                                if (filters.length != 0) {
                                    x.splice(x.indexOf(filters[0]), 1);
                                }

                                this.report.setFilters(x);
                            }


                        });
                        
                        this.report.getPages().then(pages => {
                            this.pages = pages;
                            if (siteId != null) {
                                pages => pages[0].setActive();
                            }
                            if (this.isNew) {
                                const pbip: pbi.Page = this.pages.filter(x => x.name == pages.filter(x => x.isActive)[0].name)[0];
                                pbip.getVisuals().then(visuals => {
                                    const visual: pbi.VisualDescriptor = visuals.filter(x => x.type == "tableEx" || x.type == "pivotTable")[0];
                                    visual.getCapabilities().then(capabilities => {

                                        const capabilitytasks: any[] = [];
                                        const headers: any[] = [];
                                        const values: any[] = [];
                                        //const itemvalues: any[] = [];
                                        let dataroles: any[] = [];
                                        capabilities.dataRoles.forEach(datarole => {
                                            dataroles.push(datarole);

                                            capabilitytasks.push(visual.getDataFields(datarole.name));

                                        })
                                        forkJoin(capabilitytasks).subscribe((capabilitiesresults: any[]) => {
                                            let dataroleindex: number = 0;
                                            const headertasks: any[] = [];
                                            capabilitiesresults.forEach(capabilitiesresult => {



                                                let headerindex: number = 0;
                                                capabilitiesresult.forEach((field: any) => {

                                                    headertasks.push(visual.getDataFieldDisplayName(dataroles[dataroleindex].name, headerindex));

                                                    headerindex += 1;


                                                });

                                                dataroleindex += 1;
                                            });
                                            forkJoin(headertasks).subscribe((headerresults: any[]) => {

                                                headerresults.forEach(headerresult => {
                                                    headers.push(headerresult);
                                                    let val: any = this.formdataservice.contextdata != null && this.formdataservice.contextdata[headerresult] != null ? this.formdataservice.contextdata[headerresult] : '';
                                                    values.push(val);
                                                    //itemvalues.push(val);
                                                });
                                                //itemvalues["isTemplate"] = true;
                                                this.editreportdata(this, { "data": [headers, values] }, pbip, null, true, true);





                                            });

                                        });

                                    })


                                });
                            }
                           
                            //const pbip: pbi.Page = this.pages.filter(x => x.name == pages.filter(x=>x.isActive)[0].name)[0];
                            //const fields: any = reportfields.filter(x => x.Page == pbip.name);
                           
                            
                            // if (this.pageId != null)
                            //    pages.filter(x => x.name == this.pageId)[0].setActive();
                            // else {
                          
                            // }
                        });
                    }

                });


            });
        });
    }

    fullscreen(): void {
        this.report.fullscreen();
    }
    refresh(): void {
        if (this.report) {
            this.reportService.loading = true;
            this.report.refresh().then(x => {
                this.reportService.loading = false;
            }, (error) => {
                this.reportService.loading = false;
            });
        }

    }
    
    protected addItem() {
        this.actionsservice.quickaction.name = this.actionsservice.quickaction.newname;
        this.actionsservice.quickaction.icon = this.actionsservice.quickaction.newicon;
        this.actionsservice.quickaction.action = this.actionsservice.quickaction.newaction;

        this.loadreportdata(this.actionsservice.quickaction.parameter, this.addToList, this.actionsservice.quickaction.actionparameter, true,true, this.actionsservice.quickaction.keys);
    }
    private addToList(_this: any, result: any, pbip: any, actionparameter: any, passdata: boolean, bookmark: any) {


        let rowindex = 0;

        result.data.forEach(row => {
            if (rowindex != 0) {

                _this.currentData.push(row);
            }
            else {
                if (_this.currentData.length == 0)
                    _this.currentData.push(row);
            }
            rowindex += 1;
        });
        _this.actionsservice.secondaryquickaction.data = _this.currentData.length > 0 ? _this.currentData.length - 1 : 0;
        
        _this.report.bookmarksManager.applyState(bookmark.state);
      

    
    }
    private showform(datapoint: any, actionparameter: any, keys:any[]) {
       
        if (datapoint != null && datapoint.identity != null && datapoint.identity.length > 0) {
            let isSame: boolean = true;
            if (Object.keys(this.datapointselected).length != 0) {

                datapoint.identity.forEach(value => {
                    if (this.datapointselected[value.target.column] != null) {
                        if (this.datapointselected[value.target.column] != value.equals)
                            isSame = false;
                    }
                    else {
                        isSame = false;
                    }
                });
            }
            else {
                isSame = false;
            }

            if (!isSame) {
                this.datapointselected = {};
                let matchingKeys: any[] = [];
                datapoint.identity.forEach(value => {
                    if (keys.indexOf(value.target.column) != -1)
                        matchingKeys.push(value.target.column);
                    this.datapointselected[value.target.column] = value.equals;
                    if (value.equals != null)
                        actionparameter = actionparameter.replaceAll('{{' + value.target.column + '}}', (value.equals instanceof Date || value.equals.split == null) ? value.equals : value.equals.split(' ')[0]);
                });
                if (matchingKeys.length == keys.length || keys == null || keys.length == 0) {

                    let data: any[] = [];
                    let datarow: any = {};
                    datapoint.values.forEach(value => {

                        let columnname: string = value.target.column;
                        let columnvalue: string = value.formattedValue;


                        datarow[columnname] = columnvalue;



                    });
                    data.push(datarow);

                    actionparameter = actionparameter.replaceAll('{', '').replaceAll('}', '');
                    let items: string[] = actionparameter.split(';');
                    var quickAction: any = this.actionsservice.quickaction;
                    this.popupopened = true;
                    const dialogRef = this.dialog.open(FormDialogComponent, {

                        height: '95vh',
                        minWidth: '98vw',
                        data: { FormInstanceId: items[0], FormSystemKey: items.length > 1 ? items[1] : null, Data: data }
                    });

                    dialogRef.afterClosed().subscribe(result => {

                        this.popupopened = false;
                        this.actionsservice.quickaction = quickAction;
                    });
                }
            }
           

        }
        else {
            this.datapointselected = {};
        }
    }
    datapointselected: any = {};
    private showforminstance(datapoint: any, actionparameter: any) {


        if (datapoint != null && datapoint.identity != null && datapoint.identity.length > 0) {
           
            
                datapoint.identity.forEach(value => {
                   
                    if (value.equals != null)
                        actionparameter = actionparameter.replaceAll('{{' + value.target.column + '}}', (value.equals instanceof Date || value.equals.split == null) ? value.equals : value.equals.split(' ')[0]);
                });

                actionparameter = actionparameter.replaceAll('{', '').replaceAll('}', '');
            let items: string[] = actionparameter.split(';');
            this.popupopened = true;
                const dialogRef = this.dialog.open(FormInstanceDialogComponent, {

                    height: '95vh',
                    minWidth: '98vw',
                    data: { FormInstances: [items[0]], NavigateUrl: items.length > 1 ? items[1] : null }
                });

            dialogRef.afterClosed().subscribe(result => {
                this.popupopened = false;
                    if (result != null)
                        this.router.navigate(['/' + result]);
                });
            

        }
    }
    private navigatetobasic(_this: any, datapoint: any, actionparameter: any, savestate: boolean = false) {
       // this.report.bookmarksManager.capture().then(x => {
       //     if (savestate)
       //     this.actionsservice.bookmarks[this.report.getId()] = x;
            let replaceUrl: boolean = false;

            if (datapoint != null && datapoint.identity != null && datapoint.identity.length > 0) {
                datapoint.identity.forEach(value => {
                    if (value.equals != null)
                        actionparameter = actionparameter.replace('{{' + value.target.column + '}}', (value.equals instanceof Date || value.equals.split == null) ? value.equals : value.equals.split(' ')[0]);
                });

            }
            actionparameter = actionparameter.replaceAll('{', '').replaceAll('}', '');
            if (_this.route.snapshot.paramMap.get('id'))
                _this.router.navigate(['/' + actionparameter + '/' + _this.route.snapshot.paramMap.get('id')], { replaceUrl: replaceUrl });
            else
                _this.router.navigate(['/' + actionparameter], { replaceUrl: replaceUrl });
        //});
        
    }
    private convertdata(result: any) : any[]{
        let data: any[] = [];

        let rowindex = 0;

        result.data.forEach(row => {
            if (rowindex != 0) {
                let datarow: any = {};
                let columnindex = 0;
                result.data[0].forEach(column => {
                    datarow[column] = row[columnindex];
                    columnindex += 1;
                });
                data.push(datarow);
            }
            rowindex += 1;
        });

        return data;
    }
    private navigateto(_this: any, result: any, pbip: any, actionparameter: any, passdata:boolean =true) {

       
            let data: any[] = [];

            let rowindex = 0;

            result.data.forEach(row => {
                if (rowindex != 0 ) {
                    let datarow: any = {};
                    let columnindex = 0;
                    result.data[0].forEach(column => {
                        datarow[column] = row[columnindex];
                        columnindex += 1;
                    });
                    data.push(datarow);
                }
                rowindex += 1;
            });
        if (passdata)
            _this.formdataservice.data = data;
        else
            _this.formdataservice.data = [];
        if (data.length > 0) {
            let replaceUrl: boolean = false;
            if (result.data[0].indexOf('Id') != -1 && actionparameter.indexOf('{{Id}}') != -1 && result.data.length > 1) {
                replaceUrl = false;
                actionparameter = actionparameter.replace('{{Id}}', result.data[1][result.data[0].indexOf('Id')]);
            }
            if (_this.route.snapshot.paramMap.get('id'))
                _this.router.navigate(['/' + actionparameter + '/' + _this.route.snapshot.paramMap.get('id')], { replaceUrl: replaceUrl });
            else
                _this.router.navigate(['/' + actionparameter], { replaceUrl: replaceUrl });
        }
    }
    private editreportdata(_this: any, result: any, pbip: any, actionparameter: any, passdata: boolean = true, replaceUrl: boolean = false){
        const data: form = new form();
        const jsonresult: control[] = [];
        const p: page = new page();
        p.name = pbip.displayName;
        p.nameFormula = "function:initpagename:" + pbip.displayName;
        data.pages.push(p);

        if (result.data.length > 1) {
            let rowindex = 0;
            let template: any[] = [];
            result.data[0].forEach(columnname => {
                template.push('');
            });
            template["isTemplate"] = true;
            result.data.push(template);
            result.data.forEach(datarow => {
                if (rowindex != 0 && result.data[0].length == result.data[rowindex].length) {
                    const s: section = new section();
                    if (datarow.isTemplate != null && datarow.isTemplate) {
                        s.isVisible = false;
                        s.canDelete = true;
                        s.key = "items";
                        s.originalkey = "items";
                        s.dataSource = "$.data";
                        p.repeatablesections.push(s);

                    }
                    else {
                        if (rowindex != 1)
                            s.canDelete = true;
                        p.sections.push(s);
                    }
                    // s.name = "Item " + rowindex;
                    let r: row = new row();
                   
                    s.rows.push(r);
                    let clmn: column = new column();
                    r.columns.push(clmn);
                    let columnindex = 0;
                    let date: Date;
                    const blankTimeControls: any[] = [];
                    
                    result.data[0].forEach(columnname => {
                        const existingitems: any = jsonresult.filter(x => x.name == columnname);

                        const c: control = new control();
                        
                        let value: any;

                        const pf: any[] = _this.reportfields.filter(x => x.Page == pbip.name && x.FieldName == columnname);
                        if (pf.length != 0) {
                            c.controlType = pf[0].FieldType;
                            c.isVisible = pf[0].IsVisible;
                            c.isEditable = pf[0].IsEditable;
                            c.isUnique = pf[0].IsUnique;
                            c.isKey = pf[0].IsKey;
                            c.isKeyName = pf[0].IsKeyName;
                            c.isSecondaryKey = pf[0].IsSecondaryKey;
                            c.isSecondaryKeyName = pf[0].IsSecondaryKeyName;
                            c.isSeparator = pf[0].IsSeparator;
                            c.format = pf[0].Format;
                            c.columnSize = pf[0].ColumnSize;
                            c.formula = pf[0].Formula;
                            if (c.formula != null)
                                c.isCalculateIfUnique = true;
                            c.required = pf[0].IsRequired;
                            if (pf[0].ValidationFormula != null)
                            c.validationFormula = pf[0].ValidationFormula.replace(/{{currentIndex}}/gi, existingitems.length ) ;
                        }


                        // var matches = result.data[rowindex][columnindex].match(/^(\d{4})\-(\d{2})\-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
                        if (c.controlType == 'date' || c.controlType == 'time') {
                            if (result.data[rowindex][columnindex] != '') {

                                const a: any[] = result.data[rowindex][columnindex].split(/[^0-9]/);
                                if (a[0] != 1899) {
                                    value = new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]);
                                }
                                else {
                                    value = new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]);
                                    if (c.controlType == 'time') {
                                        blankTimeControls.push(c);
                                    }
                                }


                                if (c.controlType == 'date') {
                                    if (columnname == 'Date' || columnname == 'Week Start Date') {
                                        date = value;
                                    }
                                }

                            } else {
                                if (c.controlType == 'time') {
                                    blankTimeControls.push(c);
                                }
                            }

                        }
                        if (c.controlType == 'number' || (value == null && !isNaN(Number.parseFloat(result.data[rowindex][columnindex])))) {
                            value = Number.parseFloat(result.data[rowindex][columnindex]);
                            if (c.controlType == null) {
                                c.controlType = 'number';
                            }
                        }
                        if (c.controlType == 'text' || (value == null)) {
                            value = result.data[rowindex][columnindex];
                            if (c.controlType == null) {
                                c.controlType = 'text';
                            }
                        }




                        if (c.controlType == 'date' || c.controlType == 'time') {
                            c.timeZoneOffset = new Date().getTimezoneOffset();
                        }

                        if (c.isSeparator) {
                            r = new row();
                            clmn = new column();
                            s.rows.push(r);

                            r.columns.push(clmn);
                        }


                        // let dataexists: boolean = true;
                        // if (value instanceof Date) {
                        //    dataexists = existingitems.filter(x => x.value.getTime() == value.getTime()).length != 0;
                        // }
                        // else {
                        //    dataexists = existingitems.filter(x => x.value == value).length != 0;
                        // }


                        if (existingitems.length == 0 || (existingitems.length != 0 && !c.isUnique)/* && ( !dataexists || (value == null || value == "")))*/) {
                            c.value = value;
                            c.newvalue = c.value;
                            c.name = columnname;
                            c.key = existingitems.length != 0 ? columnname + (existingitems.length + 1) : columnname + "20";
                            c.originalkey = columnname + "2";


                            jsonresult.push(c);
                            clmn.controls.push(c);
                        }


                        columnindex += 1;
                    });

                    if (date != null) {
                        blankTimeControls.forEach(c => {
                            c.defaultDate = date;
                            if (c.value != null && c.value != '') {
                                let datevalue: Date = c.value;
                                if (datevalue.getFullYear() == 1899) {
                                    datevalue = new Date(date.getFullYear(), date.getMonth(), date.getDate(), datevalue.getHours(), datevalue.getMinutes(), datevalue.getSeconds());
                                    c.value = datevalue;
                                    c.newvalue = datevalue;
                                }
                            }
                        });
                    }
                }
                rowindex += 1;
            });

        }

        const reasoncontrol: control = new control();

        reasoncontrol.controlType = 'dropdown';
        reasoncontrol.key = 'datacorrectionreason';
        reasoncontrol.name = 'Data Correction Reason';
        reasoncontrol.required = true;
        reasoncontrol.isEditable = true;
        reasoncontrol.columnSize = 2;




        let pf: any[] = _this.reportfields.filter(x => x.Page == pbip.name && x.FieldName == reasoncontrol.key);
        if (pf.length != 0) {
            reasoncontrol.controlType = pf[0].FieldType;
            reasoncontrol.isVisible = pf[0].IsVisible;
            reasoncontrol.isEditable = pf[0].IsEditable;
            if (pf[0].Options != null) {
                pf[0].Options.forEach(option => {
                    reasoncontrol.options.push({ key: option.Key, value: option.Value });
                });

            }
        } else {
            reasoncontrol.options = [{ key: 1300007, value: 'Other' }];

        }


        // let employeelookupctrl: filescontrol = new filescontrol();

        // employeelookupctrl.key = "photos";
        // employeelookupctrl.name = "Photos";
        // employeelookupctrl.isEditable = true;
        // employeelookupctrl.columnSize = 8;
        const reasonnotescontrol: control = new control();

        reasonnotescontrol.controlType = 'text';
        reasonnotescontrol.key = 'datacorrectionreasonnotes';
        reasonnotescontrol.name = 'Notes';
        reasonnotescontrol.isEditable = true;
        reasonnotescontrol.columnSize = 8;
        reasonnotescontrol.value = '';
        reasonnotescontrol.newvalue = '';
        const reasonsection: section = new section();
        const reasonrow: row = new row();
        const reasoncolumn: column = new column();
        reasoncolumn.controls.push(reasoncontrol);
        // reasoncolumn.controls.push(employeelookupctrl);
        reasonrow.columns.push(reasoncolumn);
        reasonsection.rows.push(reasonrow);
        p.sections.push(reasonsection);

        const reasonnotesrow: row = new row();
        const reasonnotescolumn: column = new column();
        reasonnotescolumn.controls.push(reasonnotescontrol);
        reasonnotesrow.columns.push(reasonnotescolumn);
        reasonsection.rows.push(reasonnotesrow);
        pf = _this.reportfields.filter(x => x.FieldName == 'isSignatureRequired' && x.Page == pbip.name);
        if (pf != null && pf.length != 0) {
            const isSignatureRequriedControl: control = new control();
            isSignatureRequriedControl.key = 'isSignatureRequired';
            isSignatureRequriedControl.name = 'Signature Required';
            isSignatureRequriedControl.controlType = 'checkbox';
            isSignatureRequriedControl.isVisible = false;
            isSignatureRequriedControl.required = false;
            isSignatureRequriedControl.isEditable = true;
            isSignatureRequriedControl.visibilitydependencies = [{ key: 'signature' }];

            const signaturecontrol: lookupcontrol = new lookupcontrol();
            signaturecontrol.key = 'signature';
            signaturecontrol.name = 'Signatures';
            signaturecontrol.isEditable = true;
            signaturecontrol.columnSize = 8;
            signaturecontrol.type = 'employee';
            signaturecontrol.required = true;
            signaturecontrol.isVisible = false;
            signaturecontrol.isScanningOnly = true;
            // signaturecontrol.requireddependencies = ["isSignatureRequired"];

            const signaguresection: section = new section();
            // signaguresection.isVisible = false;
            signaguresection.name = 'Electronic Signatures';
            const signagurerow: row = new row();
            const signaturecolumn: column = new column();
            signaturecolumn.controls.push(signaturecontrol);
            signaturecolumn.controls.push(isSignatureRequriedControl);
            signagurerow.columns.push(signaturecolumn);
            signaguresection.rows.push(signagurerow);
            data.pages[data.pages.length - 1].sections.push(signaguresection);
        }


        _this.formdataservice.reportId = _this.report.getId();
        _this.formdataservice.pageId = _this.reportfields.filter(x => x.Page == pbip.name)[0].PageId;
        _this.formdataservice.form = data;

        _this.router.navigate(['/correctdatadetail'], { replaceUrl: true });
        console.log('Parsed: ', result);
    }
    exportdata(rows: any, clonedvisual: any, visuals: any[], handler: any, pbip: any, actionparameter: any, passdata: any, bookmark: any) {
        const data: any = rows;
        this.ngxCsvParser.parse(data.data, {
            complete: (result) => {
                clonedvisual.getFilters().then(filters => {
                    visuals = visuals.filter(v => v.name != clonedvisual.name);
                    result.data = result.data.slice(0, result.data.length - 1);
                    handler(this, result, pbip, actionparameter, passdata, bookmark);

                    let type: any = clonedvisual.type;
                    let newtype: any;
                    if (type == 'tableEx')
                        newtype = 'pivotTable'
                    else if (type == 'pivotTable')
                        newtype = 'tableEx';
                    clonedvisual.changeType(newtype).then(ct => {
                        clonedvisual.changeType(type).then(ct1 => {

                            clonedvisual = null;
                        });


                    });


                });
            }
        });
    }
    loadreportdata(this,data: any, handler: any, actionparameter: any, multiselection: boolean = false, passdata:boolean = true, keys: any[] = null): void {

       
   
        this.report.bookmarksManager.capture({ allPages: false, personalizeVisuals: false }).then(bookmark => {
                
                this.report.getPages().then(pages => {
                    const pbip: pbi.Page = pages.filter(x => x.name == data.detail.page.name)[0];
                    
                    if (!multiselection && this.actionsservice.quickaction.multiselect) {
                        handler(this, { data: this.currentData }, pbi, actionparameter, passdata);
                    }
                    else {
                        pbip.getVisuals().then(visuals => {
                            const cloneRequest: pbi.models.ICloneVisualRequest = {
                                filters: data.detail.filters,
                                layout: {

                                    displayState: { mode: pbi.models.VisualContainerDisplayMode.Hidden }
                                }


                            };
                            const index = 0;
                            data.detail.dataPoints.forEach(dataPoint => {
                                dataPoint.identity.forEach(identity => {
                                    if (identity.equals != null) {
                                        if (keys == null || keys.indexOf(identity.target.column) != -1)
                                            {
                                            if (identity.equals instanceof Date) {
                                                let existingfilters: any = cloneRequest.filters.filter(x => (x as any).target.column == identity.target.column && (x as any).operator == 'Is');
                                                if (existingfilters.length == 0) {
                                                    let value: any = [this.datePipe.transform(new Date(identity.equals.getUTCFullYear(), identity.equals.getUTCMonth(), identity.equals.getUTCDate(), identity.equals.getUTCHours(), identity.equals.getUTCMinutes(), identity.equals.getUTCSeconds()), 'yyyy-MM-ddTHH:mm:ss.000')] + 'Z';
                                                    const basicFilter: any = {
                                                        $schema: 'http://powerbi.com/product/schema#advanced',
                                                        target: {
                                                            table: identity.target.table,
                                                            column: identity.target.column
                                                        },
                                                        logicalOperator: 'And',
                                                        conditions: [
                                                            {
                                                                operator: 'Is',
                                                                value: value
                                                            }

                                                        ],
                                                        filterType: 0
                                                    };
                                                    cloneRequest.filters.push(basicFilter);
                                                }
                                            }
                                            else {
                                                let existingfilters: any = cloneRequest.filters.filter(x => (x as any).target.column == identity.target.column && (x as any).operator == 'In');
                                                if (existingfilters.length != 0) {
                                                    existingfilters[0].values.push(identity.equals);
                                                }
                                                else {
                                                    const basicFilter: pbi.models.IBasicFilter = {
                                                        $schema: 'http://powerbi.com/product/schema#basic',
                                                        target: {
                                                            table: identity.target.table,
                                                            column: identity.target.column
                                                        },
                                                        operator: 'In',
                                                        values: [identity.equals],
                                                        filterType: pbi.models.FilterType.Basic
                                                    };

                                                    cloneRequest.filters.push(basicFilter);
                                                }
                                            }
                                        }
                                    }
                                });
                            });
                            
                            //data.detail.dataPoints[0].identity.forEach(identity => {
                            //    if (identity.equals != null) {
                            //        let value: any;
                            //        if (identity.equals instanceof Date) {

                            //            value = value = [this.datePipe.transform(new Date(identity.equals.getUTCFullYear(), identity.equals.getUTCMonth(), identity.equals.getUTCDate(), identity.equals.getUTCHours(), identity.equals.getUTCMinutes(), identity.equals.getUTCSeconds()), 'yyyy-MM-ddTHH:mm:ss.000')] + 'Z';
                            //            const basicFilter: any = {
                            //                $schema: 'http://powerbi.com/product/schema#advanced',
                            //                target: {
                            //                    table: identity.target.table,
                            //                    column: identity.target.column
                            //                },
                            //                logicalOperator: 'And',
                            //                conditions: [
                            //                    {
                            //                        operator: 'Is',
                            //                        value: value
                            //                    }

                            //                ],
                            //                filterType: 0
                            //            };
                            //            cloneRequest.filters.push(basicFilter);

                            //        } else {
                            //            value = identity.equals;

                            //            const basicFilter: pbi.models.IBasicFilter = {
                            //                $schema: 'http://powerbi.com/product/schema#basic',
                            //                target: {
                            //                    table: identity.target.table,
                            //                    column: identity.target.column
                            //                },
                            //                operator: 'In',
                            //                values: [value],
                            //                filterType: pbi.models.FilterType.Basic
                            //            };

                            //            cloneRequest.filters.push(basicFilter);

                                       
                            //        }

                                   
                            //    }

                            //});
                            

                            // visuals.filter(x => x.name == data.detail.visual.name)[0].clone(cloneRequest).then(clone => {
                            //    pbip.getVisuals().then(x => {
                            //        const clonedvisual: pbi.VisualDescriptor = x.filter(x => x.name == data.detail.visual.name)[0];
                            //         clonedvisual.layout.displayState.mode = 1;

                            var clonedvisual = visuals.filter(x => x.name == data.detail.visual.name)[0];
                           
                            clonedvisual.setFilters(cloneRequest.filters).then(f => {
                                
                                this.visualRendered =  this.report.on('visualRendered', (visual) => {
                                    if (clonedvisual != null && visual.detail.name == clonedvisual.name) {
                                        this.report.off('visualRendered');
                                        clonedvisual.exportData().then(rows => {
                                            
                                            this.exportdata(rows, clonedvisual, visuals, handler, pbip, actionparameter, passdata, bookmark);
                                         
                                        }, error => {
                                                clonedvisual.exportData().then(rows => {
                                                    this.exportdata(rows, clonedvisual, visuals, handler, pbip, actionparameter, passdata, bookmark);
                                                },
                                                    error => {
                                                        this.report.bookmarksManager.applyState(bookmark.state);
                                                    }
                                                );
                                                
                                        });
                                    }
                                });  
                            });
                            //  });

                            //});
                        });
                    }

                });
            });
        

    }
    removebookmark(): void {


        this.reportService.removeReportBookmark(this.bookmark.Id).subscribe(x => {
            this.report.reload();
            this.actionsservice.bookmarked = false;
            // this.vehicle = x;
            this.snackBar.open('The bookmark has been successfully removed.', 'Close', {
                duration: 3000,
                panelClass: ['snackbar-success']
            });
        },
        (error) => {

            this.snackBar.open('An error occured while removing the bookmark.', 'Close', {
                duration: 10000,
                panelClass: ['snackbar-error']
            });
        });

    }

    savebookmark(): void {

        this.report.bookmarksManager.capture().then(x => {
            this.bookmark.State = x.state;
            this.bookmark.Name = 'default';
            this.bookmark.ReportId = this.report.getId();


            this.reportService.saveReportBookmark(this.bookmark.ReportId, this.bookmark).subscribe(x => {
                this.bookmark = x;
                this.actionsservice.bookmarked = true;
                // this.vehicle = x;
                this.snackBar.open('The bookmark has been successfully saved.', 'Close', {
                    duration: 3000,
                    panelClass: ['snackbar-success']
                });
            },
            (error) => {

                this.snackBar.open('An error occured while saving the bookmark.', 'Close', {
                    duration: 10000,
                    panelClass: ['snackbar-error']
                });
            });
        });

    }
    refreshtoken(): void {
        this.adalService.getToken(['https://analysis.windows.net/powerbi/api/Report.Read.All'] ).then(token => {

            this.report.setAccessToken(token);
            const currentTime = Date.now();
            const expiration = this.helper.getTokenExpirationDate(token).getTime();
            const safetyInterval = 2 * 60 * 1000;

            const timeout = expiration - currentTime - safetyInterval;
            this.interval = setTimeout(() => {
                this.refreshtoken();
                // this.refresh(); // api call
            }, timeout);
        });
    }

    getHeight() {
        return this.breakpointObserver.isMatched(Breakpoints.Handset) ? 'calc(100vh)' : 'calc(100vh)';
    }
    openBottomSheet(): void {
        const ref = this.bottomSheet.open(ReportBottomSheet);
        ref.instance.pages = this.pages.filter(x => x.visibility == 0);
        ref.afterDismissed().subscribe(() => {
            if (ref.instance.action == 'refresh') {
                this.refresh();
            } else if (ref.instance.action == 'removebookmark') {
                this.removebookmark();
            } else if (ref.instance.action == 'fullscreen') {
                this.fullscreen();
            } else if (ref.instance.action == 'setcurrentpage') {
                this.report.setPage(ref.instance.currentpage.name);
            } else if (ref.instance.action == 'savebookmark') {
                this.savebookmark();
            }



        });
    }
}

@Component({
    selector: 'reportbottomsheet',
    templateUrl: 'reportbottomsheet.component.html',
})
export class ReportBottomSheet {
    constructor(private bottomSheetRef: MatBottomSheetRef<ReportBottomSheet>, public actionsservice: ActionsService) { }
    action: string;
    pages: any[];
    childactions = false;
    currentpage: any;
    refresh(): void {
        this.action = 'refresh';

        this.bottomSheetRef.dismiss();
        event.preventDefault();
    }
    removebookmark(): void {
        this.action = 'removebookmark';

        this.bottomSheetRef.dismiss();
        event.preventDefault();
    }
    fullscreen(): void {
        this.action = 'fullscreen';

        this.bottomSheetRef.dismiss();
        event.preventDefault();
    }
    reportpages(): void {
        this.childactions = true;
    }

    savebookmark(): void {
        this.action = 'savebookmark';

        this.bottomSheetRef.dismiss();
        event.preventDefault();
    }

    setcurrentpage(page): void {
        this.action = 'setcurrentpage';
        this.currentpage = page;
        this.childactions = false;

        this.bottomSheetRef.dismiss();
        event.preventDefault();
    }

}