# #############################################################
# Context menu constructed via CLI args.
# Originally by Avi Halachmi (:avih) https://github.com/avih
# Extended by Thomas Carmichael (carmanaught) https://gitlab.com/carmanaught
#
# Developed for and used in conjunction with menu-engine.lua - context-menu for mpv.
# See menu-engine.lua for more info.
#
# 2017-02-02 - Version 0.1 - Initial version (avih)
# 2017-07-19 - Version 0.2 - Extensive rewrite (carmanught)
# 2017-07-22 - Version 0.3 - Change accelerator label handling (right align) and adjust
#                            changemenu check to match mpvcontextmenu.lua changes
# 2017-07-27 - Version 0.4 - Make the menuchange parsing more dynamic to match with the
#                            changes in mpvcontextmenu.lua
# 2018-06-23 - Version 0.5 - Split the argument list on the ASCII unit separator
# 2019-08-10 - Version 0.6 - Configure the font by parsing arguments and change how
#                            the errorValue variable is accessed.
# 2024-03-16 - Version 0.7 - Rewrite the menu builder to be able to parse JSON and build
#                            the menu from the data passed through.
#
# #############################################################

# Required when launching via tclsh, no-op when launching via wish
package require Tk
# We need this to parse the JSON that's received.
package require json
package require json::write
# Set the default (fallback) font, which probably won't be used unless the calling script
# doesn't actually provide a value
font create defFont -family "Source Code Pro" -size 9
option add *font defFont

# Remove the main window from the host window manager
wm withdraw .

if { $::argc < 1 } {
    puts "Usage: menu-build-tk.tcl {{\"JSON\":\"DATA\"}}"
    exit 1
}

set menuData [json::json2dict [lindex $argv 0]]

# Setup a bunch of menu label values
# Checkbutton/Radiobutton text values here to use in place of Tk checkbutton/radiobutton
# since the styling doesn't seem to show for the tk_popup, except when checked. It's
# important that a monospace font is used for the menu items to appear correctly.
set boxCheck "\[X\] "
set boxUncheck "\[ \] "
set radioSelect "(X) "
set radioEmpty "( ) "
set boxA "\[A\] "
set boxB "\[B\] "
# An empty prefix label that is spaces that count to the the same number of characters as
# the button labels
set emptyPre "    "
# This is to put a bit of a spacer between label and accelerator
set accelSpacer "   "
set labelPre ""

# Various other global variables
set RESP_CANCEL -1
set postMenu "false"
set postMenus ""
set postIndexes ""
set errorValue "errorValue"
array set maxAccel {}

# Start doing configuration and set values from the JSON
font configure defFont -family "[dict get $menuData fontFace]"
font configure defFont -size [dict get $menuData fontSize]
set pos_x [dict get $menuData x]
set pos_y [dict get $menuData y]
set baseMenuName [dict get $menuData menuName]
set baseMenu [menu .$baseMenuName -tearoff 0]
set menuLimit [dict get $menuData menuLimit]
set postMenus [dict get $menuData menuPaths]
set postIndexes [dict get $menuData menuIndexes]
if {$postMenus != ""} {
    set postMenu "true"
}

set menu [dict get $menuData menu]

# To make the accelerator appear as if it's justified to the right, we iterate through
# the entire list in a given menu and set the maximum accelerator length for each menu
# after checking if a value exists first and then increasing the max value if the length
# of an item is greater than a previous max length value.
dict for {menuKey menuVal} $menu {
    if {[dict exists $menu $menuKey 1]} {
        set subMenu [dict get $menu $menuKey]

        dict for {subKey subval} $subMenu {
            set itemType [dict get $subMenu $subKey itemType]
            if {$itemType != "cascade" && $itemType != "separator"} {
                if {[dict exists $subMenu $subKey accelerator]} {
                    set accel [dict get $subMenu $subKey accelerator]
                } else {
                    set accel ""
                }

                if {![info exists ::maxAccel($menuKey)]} {
                    set ::maxAccel($menuKey) [string length $accel]
                } else {
                    if {[string length $accel] > $::maxAccel($menuKey)} {
                        set ::maxAccel($menuKey) [string length $accel]
                    }
                }
            }
        }
    }
}

# We call this when creating the accelerator labels, passing the current menu and the
# accelerator, getting the max length for that menu and adding 4 spaces, then appending
# the label after the spaces, making it appear justified to the right.
proc makeLabel {curTable accelLabel} {
    set spacesCount [expr [expr $::maxAccel($curTable) + 4] - [string length $accelLabel]]
    set whiteSpace [string repeat " " $spacesCount]
    set fullLabel $whiteSpace$accelLabel
    return $fullLabel
}

# Build the menu from the JSON here, iterating through the JSON structure to build the
# menu before displaying the it.
proc buildMenu {curMenu curPath prePath mLvl} {
    set thisMenu [dict get $::menu $curMenu]
    if {![winfo exists $curPath]} {
            menu $curPath -tearoff 0
    }

    # We limit the number of sub-menus that can be recursed through for building
    # to prevent infinite recursion.
    if {$mLvl <= $::menuLimit} {
        for {set i 1} {$i <= [dict size $thisMenu]} {incr i} {
            # There should always be an itemType value
            set itemType [dict get $thisMenu $i itemType]

            # Get the label
            if {[dict exists $thisMenu $i labelVal]} {
                set label [dict get $thisMenu $i labelVal]
            } elseif {[dict exists $thisMenu $i label]} {
                set label [dict get $thisMenu $i label]
            } else { set label "" }

            # Get the accelerator
            if {[dict exists $thisMenu $i acceleratorVal]} {
                set accel [dict get $thisMenu $i acceleratorVal]
            } elseif {[dict exists $thisMenu $i accelerator]} {
                set accel [dict get $thisMenu $i accelerator]
            } else { set accel "" }

            # Get the item state
            if {[dict exists $thisMenu $i itemStateVal]} {
                set itemState [dict get $thisMenu $i itemStateVal]
            } elseif {[dict exists $thisMenu $i itemState]} {
                set itemState [dict get $thisMenu $i itemState]
            } else { set itemState true }

            # Get the get the item disable state
            if {[dict exists $thisMenu $i itemDisableVal]} {
                set itemDisable [dict get $thisMenu $i itemDisableVal]
                if {$itemDisable == "false"} {
                    set itemDisable "normal"
                } elseif {$itemDisable == "true"} {
                    set itemDisable "disabled"
                } else { set itemDisable "normal" }
            } elseif {[dict exists $thisMenu $i itemDisable]} {
                set itemDisable [dict get $thisMenu $i itemDisable]
                if {$itemDisable == "false"} {
                    set itemDisable "normal"
                } elseif {$itemDisable == "true"} {
                    set itemDisable "disabled"
                } else { set itemDisable "normal" }
            } else {
                set itemDisable "normal"
            }

            if {$itemType == "cascade"} {
                set nextMenu $accel
                set nextPath $curPath.$nextMenu
                buildMenu $nextMenu $curPath.$nextMenu $nextPath [expr $mLvl + 1]
                $prePath add cascade -label $::emptyPre$label -state $itemDisable -menu $nextPath
            }

            if {$itemType == "separator"} {
                $curPath add separator
            }

            if {$itemType == "command"} {
                $curPath add command -label $::emptyPre$label -accel [makeLabel $curMenu $accel] -state $itemDisable -command "done $curMenu $i $curPath"
            }

            # The checkbutton/radiobutton items are just 'add command' items with a label prefix to
            # give a textual appearance of check/radio items showing their status.

            if {$itemType == "checkbutton"} {
                if {$itemState == "true"} {
                    set labelPre $::boxCheck
                } else {
                    set labelPre $::boxUncheck
                }
                $curPath add command -label $labelPre$label -accel [makeLabel $curMenu $accel] -state $itemDisable -command "done $curMenu $i $curPath"
            }

            if {$itemType == "radiobutton"} {
                if {$itemState == "true"} {
                    set labelPre $::radioSelect
                } else {
                    set labelPre $::radioEmpty
                }
                $curPath add command -label $labelPre$label -accel [makeLabel $curMenu $accel] -state $itemDisable -command "done $curMenu $i $curPath"
            }

            if {$itemType == "ab-button"} {
                if {$itemState == "a"} {
                    set labelPre $::boxA
                } elseif {$itemState == "b"} {
                    set labelPre $::boxB
                } elseif {$itemState == "off"} {
                    set labelPre $::boxUncheck
                }
                $curPath add command -label $labelPre$label -accel [makeLabel $curMenu $accel] -state $itemDisable -command "done $curMenu $i $curPath"
            }
        }
    } else {
        set ::errorValue "Too many menu levels. No more than $::menuLimit menu levels total."
        cancelled
    }
}

buildMenu $baseMenuName $baseMenu $baseMenu 1

# Read the absolute mouse pointer position if we're not given a pos via argv
if {$pos_x == -1 && $pos_y == -1} {
    set pos_x [winfo pointerx .]
    set pos_y [winfo pointery .]
}

# On item-click/menu-dismissed, we print a json object to stdout with values to be
# used in the menu engine
proc done {menuName index menuPath} {
    puts " {\"x\":\"$::pos_x\", \"y\":\"$::pos_y\", \"menuname\":\"$menuName\", \"index\":\"$index\", \"menupath\":\"$menuPath\", \"errorvalue\":\"$::errorValue\"} "
    exit
}

# Seemingly, on both windows and linux, "cancelled" is reached after the click but
# before the menu command is executed and _a_sync to it. Therefore we wait a bit to
# allow the menu command to execute first (and exit), and if it didn't, we exit here.
proc cancelled {} {
    after 100 {done $baseMenuName $::RESP_CANCEL $baseMenuName}
}

# Calculate the menu position relative to the Tk window
set win_x [expr {$pos_x - [winfo rootx .]}]
set win_y [expr {$pos_y - [winfo rooty .]}]

# Launch the popup menu
tk_popup $baseMenu $win_x $win_y
# Use after idle and check if the 'post' menu check is true and do a postcascade on the
# relevant menus to have the menu pop back up, with the cascade in the same place.
# Note: This doesn't work on Windows, as per the comment below regarding tk_popup being
#       synchronous and will only run after the menu is closed.
after idle {
    if {$postMenu == "true"} {
        set menuArgs [split $postMenus "?"]
        set indexArgs [split $postIndexes "?"]
        for {set i 0} {$i < [llength $indexArgs]} {incr i} {
            [lindex $menuArgs $i] postcascade [lindex $indexArgs $i]
        }
    }
}

# On Windows tk_popup is synchronous and so we exit when it closes, but on Linux
# it's async and so we need to bind to the <Unmap> event (<Destroyed> or
# <FocusOut> don't work as expected, e.g. when clicking elsewhere even if the
# popup disappears. <Leave> works but it's an unexpected behavior for a menu).
# Note: If we don't catch the right event, we'd have a zombie process since no
#       window. Equally important - the script will not exit.
# Note: Untested on macOS (macports' tk requires xorg. meh).
if {$tcl_platform(platform) == "windows"} {
    cancelled
} else {
    bind $baseMenu <Unmap> cancelled
}
