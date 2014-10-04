/*
 * Copyright (c) 2014 MKLab. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, $, _, window, staruml, type, appshell, document */

define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils     = staruml.getModule("utils/ExtensionUtils"),
        PanelManager       = staruml.getModule("utils/PanelManager"),
        Repository         = staruml.getModule("engine/Repository"),
        SelectionManager   = staruml.getModule("engine/SelectionManager"),
        CommandManager     = staruml.getModule("command/CommandManager"),
        Commands           = staruml.getModule("command/Commands"),
        MenuManager        = staruml.getModule("menu/MenuManager"),
        ContextMenuManager = staruml.getModule("menu/ContextMenuManager"),
        ModelExplorerView  = staruml.getModule("explorer/ModelExplorerView"),
        PreferenceManager  = staruml.getModule("preference/PreferenceManager");

    var relationshipPanelTemplate = require("text!relationship-panel.html"),
        relationshipItemTemplate = require("text!relationship-item.html"),
        relationshipPanel,
        listView,
        $relationshipPanel,
        $listView,
        $title,
        $close,
        $button = $("<a id='toolbar-relationship-view' href='#' title='Relationship View'></a>");

    var CMD_RELATIONSHIP_VIEW = "view.relationships",
        PREFERENCE_KEY = "view.relationships.visibility";

    /**
     * DataSource for ListView
     * @type {kendo.data.DataSource}
     */
    var dataSource = new kendo.data.DataSource();

    /**
     * Clear All Relationship Items
     */
    function clearRelationshipItems() {
        dataSource.data([]);
    }

    /**
     * Add a Relationship Item
     * @param {Relationship} rel
     * @param {Model} elem
     * @param {string} role
     */
    function addRelationshipItem(rel, elem, role) {
        dataSource.add({
            id: elem._id,
            role: (role ? role + ":" : ""),
            relId: rel._id,
            relName: rel.name,
            relIcon: rel.getNodeIcon(),
            relType: rel.getClassName(),
            icon: elem.getNodeIcon(),
            name: elem.name,
            type: elem.getClassName()
        });
    }

    /**
     * Show Relationships Panel
     */
    function show() {
        relationshipPanel.show();
        $button.addClass("selected");
        CommandManager.get(CMD_RELATIONSHIP_VIEW).setChecked(true);
        PreferenceManager.set(PREFERENCE_KEY, true);
    }

    /**
     * Hide Relationships Panel
     */
    function hide() {
        relationshipPanel.hide();
        $button.removeClass("selected");
        CommandManager.get(CMD_RELATIONSHIP_VIEW).setChecked(false);
        PreferenceManager.set(PREFERENCE_KEY, false);
    }

    /**
     * Toggle Relationships Panel
     */
    function toggle() {
        if (relationshipPanel.isVisible()) {
            hide();
        } else {
            show();
        }
    }


    function _handleSelectRelatedElement() {
        if (listView.select().length > 0) {
            var data = dataSource.view(),
                item = data[listView.select().index()],
                element = Repository.get(item.id);
            if (element) {
                ModelExplorerView.select(element, true);
            }
        }
    }

    function _handleSelectRelationship() {
        if (listView.select().length > 0) {
            var data = dataSource.view(),
                item = data[listView.select().index()],
                element = Repository.get(item.relId);
            if (element) {
                ModelExplorerView.select(element, true);
            }
        }
    }

    /**
     * Setup ContextMenu
     */
    function _setupContextMenu() {

        var CMD_SELECT_RELATED_ELEMENT = "relationshipView.selectRelatedElement",
            CMD_SELECT_RELATIONSHIP    = "relationshipView.selectRelationship";

        CommandManager.register("Select Related Element", CMD_SELECT_RELATED_ELEMENT, _handleSelectRelatedElement);
        CommandManager.register("Select Relationship",    CMD_SELECT_RELATIONSHIP,    _handleSelectRelationship);

        var CONTEXT_MENU = "context-menu-relationship-view";
        var contextMenu;
        contextMenu = ContextMenuManager.addContextMenu(CONTEXT_MENU, "#relationship-view div.listview");
        contextMenu.addMenuItem(CMD_SELECT_RELATED_ELEMENT);
        contextMenu.addMenuItem(CMD_SELECT_RELATIONSHIP);
    }


    /**
     * Initialize Extension
     */
    function init() {
        // Load our stylesheet
        ExtensionUtils.loadStyleSheet(module, "styles.less");

        // Toolbar Button
        $("#toolbar .buttons").append($button);
        $button.click(function () {
            CommandManager.execute(CMD_RELATIONSHIP_VIEW);
        });

        // Setup RelationshipPanel
        $relationshipPanel = $(relationshipPanelTemplate);
        $title = $relationshipPanel.find(".title");
        $close = $relationshipPanel.find(".close");
        $close.click(function () {
            hide();
        });
        relationshipPanel = PanelManager.createBottomPanel("?", $relationshipPanel, 29);

        // Setup Relationship List
        $listView = $relationshipPanel.find(".listview");
        $listView.kendoListView({
            dataSource: dataSource,
            template: relationshipItemTemplate,
            selectable: true
        });
        listView = $listView.data("kendoListView");

        // Register Commands
        CommandManager.register("Relationships", CMD_RELATIONSHIP_VIEW, toggle);

        // Setup Menus
        var menu = MenuManager.getMenu(Commands.VIEW);
        menu.addMenuDivider();
        menu.addMenuItem(CMD_RELATIONSHIP_VIEW, ["Ctrl-Alt-R"]);

        // Handler for selectionChanged event
        $(SelectionManager).on("selectionChanged", function (event, models, views) {
            clearRelationshipItems();
            if (models.length === 1) {
                var m = models[0],
                    rels = Repository.getRelationshipsOf(m);
                for (var i = 0, len = rels.length; i < len; i++) {
                    var rel = rels[i],
                        otherSide,
                        role;
                    if (rel instanceof type.DirectedRelationship) {
                        if (rel.source === m) {
                            otherSide = rel.target;
                            role = "(target)";
                        } else {
                            otherSide = rel.source;
                            role = "(source)";
                        }
                    } else if (rel instanceof type.UndirectedRelationship) {
                        if (rel.end1.reference === m) {
                            otherSide = rel.end2.reference;
                            role = rel.end2.name;
                        } else {
                            otherSide = rel.end1.reference;
                            role = rel.end1.name;
                        }
                    }
                    if (rel && otherSide) {
                        addRelationshipItem(rel, otherSide, role);
                    }
                }
            }
        });

        // Load Preference
        var visible = PreferenceManager.get(PREFERENCE_KEY);
        if (visible === true) {
            show();
        } else {
            hide();
        }

        _setupContextMenu();
    }

    // Initialize Extension
    init();

});