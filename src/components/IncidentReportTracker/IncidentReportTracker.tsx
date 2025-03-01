/*
 * Copyright (C)  Online-Go.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as React from "react";
import * as moment from "moment";
import * as data from "data";
import * as preferences from "preferences";
import { Link } from "react-router-dom";
import { alert } from "swal_config";
import { _, pgettext } from "translate";
import { post } from "requests";
import { usePreference } from "preferences";
import { Player } from "Player";
import { ignore, errorAlerter } from "misc";
import { openReportedConversationModal } from "ReportedConversationModal";
import { AutoTranslate } from "AutoTranslate";
import { report_categories } from "Report";
import { Report, report_manager } from "report_manager";
import { useRefresh } from "hooks";

export function IncidentReportTracker(): JSX.Element {
    const [show_incident_list, setShowIncidentList] = React.useState(false);
    const [normal_ct, setNormalCt] = React.useState(0);
    const [hide_icon] = usePreference("hide-incident-reports");
    const refresh = useRefresh();

    function toggleList() {
        setShowIncidentList(!show_incident_list);
    }

    React.useEffect(() => {
        const onReport = (report: Report) => {
            if (report.state !== "resolved") {
                report.unclaim = () => {
                    post("moderation/incident/%%", report.id, { id: report.id, action: "unclaim" })
                        .then(ignore)
                        .catch(errorAlerter);
                };
                report.good_report = () => {
                    post("moderation/incident/%%", report.id, {
                        id: report.id,
                        action: "resolve",
                        was_helpful: true,
                    })
                        .then(ignore)
                        .catch(errorAlerter);
                };
                report.bad_report = () => {
                    post("moderation/incident/%%", report.id, {
                        id: report.id,
                        action: "resolve",
                        was_helpful: false,
                    })
                        .then(ignore)
                        .catch(errorAlerter);
                };
                report.steal = () => {
                    post("moderation/incident/%%", report.id, { id: report.id, action: "steal" })
                        .then((res) => {
                            if (res.vanished) {
                                void alert.fire("Report was removed");
                            }
                        })
                        .catch(errorAlerter);
                };
                report.claim = () => {
                    post("moderation/incident/%%", report.id, { id: report.id, action: "claim" })
                        .then((res) => {
                            if (res.vanished) {
                                void alert.fire("Report was removed");
                            }
                            if (res.already_claimed) {
                                void alert.fire("Report was removed");
                            }
                        })
                        .catch(errorAlerter);
                };
                report.cancel = () => {
                    post("moderation/incident/%%", report.id, { id: report.id, action: "cancel" })
                        .then(ignore)
                        .catch(errorAlerter);
                };

                report.set_note = () => {
                    void alert
                        .fire({
                            input: "text",
                            inputValue: report.moderator_note,
                            showCancelButton: true,
                        })
                        .then(({ value: txt, isConfirmed }) => {
                            if (isConfirmed) {
                                post("moderation/incident/%%", report.id, {
                                    id: report.id,
                                    action: "note",
                                    note: txt,
                                })
                                    .then(ignore)
                                    .catch(errorAlerter);
                            }
                        });
                };
            }
        };

        report_manager.on("incident-report", onReport);
        report_manager.on("active-count", setNormalCt);
        report_manager.on("update", refresh);

        return () => {
            report_manager.off("incident-report", onReport);
            report_manager.off("active-count", setNormalCt);
            report_manager.off("update", refresh);
        };
    }, []);

    const user = data.get("user");
    const reports = report_manager.sorted_active_incident_reports;

    if (reports.length === 0 && !user.is_moderator) {
        return null;
    }

    function getReportType(report: Report): string {
        if (report.report_type === "appeal") {
            return "Ban Appeal";
        }

        const report_category = report_categories.filter((r) => r.type === report.report_type)[0];
        const report_type_title = report_category?.title || "Other";
        return report_type_title;
    }

    const filtered_reports = reports.filter(
        (report) =>
            !preferences.get("hide-claimed-reports") ||
            report.moderator === null ||
            report.moderator.id === user.id,
    );

    if (hide_icon) {
        return null;
    }

    return (
        <>
            <div className="IncidentReportIndicator" onClick={toggleList}>
                <i className={`fa fa-exclamation-triangle ${normal_ct > 0 ? "active" : ""}`} />
                <span className={`count ${normal_ct > 0 ? "active" : ""}`}>{normal_ct}</span>
            </div>
            {show_incident_list && (
                <div className="IncidentReportTracker">
                    <div className="IncidentReportList-backdrop" onClick={toggleList}></div>
                    <div className="IncidentReportList-results">
                        <h1>
                            <Link to="/reports-center/all">Go to the new Reports Center</Link>
                        </h1>
                        <hr />
                        {filtered_reports.length === 0 && (
                            <div>
                                {pgettext(
                                    "Shown to moderators when there are no active reports",
                                    "No reports left, great job team!",
                                )}
                            </div>
                        )}
                        {filtered_reports.map((report) => (
                            <div className="incident" key={report.id}>
                                <div className="report-header">
                                    <div className="report-id">
                                        {"R" + `${report.id}`.slice(-3) + ": "}
                                        {getReportType(report)}
                                    </div>
                                    {((!report.moderator && user.is_moderator) || null) && (
                                        <button className="primary xs" onClick={report.claim}>
                                            {_("Claim")}
                                        </button>
                                    )}
                                    {user.is_moderator && report.moderator && (
                                        <Player user={report.moderator} icon />
                                    )}
                                </div>
                                {(report.reporter_note || null) && (
                                    <h4 className="notes">
                                        {report.reporter_note_translation ? (
                                            <>
                                                {report.reporter_note_translation.source_text}
                                                {(report.reporter_note_translation
                                                    .target_language !==
                                                    report.reporter_note_translation
                                                        .source_language ||
                                                    null) && (
                                                    <>
                                                        <div className="source-to-target-languages">
                                                            {
                                                                report.reporter_note_translation
                                                                    .source_language
                                                            }{" "}
                                                            =&gt;{" "}
                                                            {
                                                                report.reporter_note_translation
                                                                    .target_language
                                                            }
                                                        </div>
                                                        <div className="translated">
                                                            {
                                                                report.reporter_note_translation
                                                                    .target_text
                                                            }
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <AutoTranslate source={report.reporter_note} />
                                        )}
                                    </h4>
                                )}

                                {(report.system_note || null) && (
                                    <h4 className="notes">{report.system_note}</h4>
                                )}

                                <div className="notes">
                                    <i>{user.is_moderator ? report.moderator_note || "" : ""}</i>
                                </div>

                                <div className="spread">
                                    {(report.url || null) && (
                                        <a href={report.url} target="_blank">
                                            {report.url}
                                        </a>
                                    )}

                                    {(report.reported_user || null) && (
                                        <span>
                                            {_("Reported user")}:{" "}
                                            <Player user={report.reported_user} icon />
                                        </span>
                                    )}
                                    {(report.reported_game || null) && (
                                        <span>
                                            {_("Game")}:{" "}
                                            <Link to={`/game/view/${report.reported_game}`}>
                                                #{report.reported_game}
                                            </Link>
                                        </span>
                                    )}
                                    {(report.reported_review || null) && (
                                        <span>
                                            {_("Review")}:{" "}
                                            <Link to={`/review/${report.reported_review}`}>
                                                ##{report.reported_review}
                                            </Link>
                                        </span>
                                    )}
                                </div>

                                {(report.report_type === "appeal" || null) && (
                                    <h3>
                                        <Link to={`/appeal/${report.reported_user.id}`}>
                                            View Appeal
                                        </Link>
                                    </h3>
                                )}

                                {(report.reported_conversation || null) && (
                                    <div
                                        className="spread"
                                        onClick={() => {
                                            openReportedConversationModal(
                                                report.reported_user?.id,
                                                report.reported_conversation,
                                            );
                                        }}
                                    >
                                        <span id="conversation">
                                            {_("View Reported Conversation")}
                                        </span>
                                    </div>
                                )}

                                <div className="spread">
                                    {((report.moderator &&
                                        user.is_moderator &&
                                        user.id !== report.moderator.id) ||
                                        null) && (
                                        <button className="danger xs" onClick={report.steal}>
                                            {_("Steal")}
                                        </button>
                                    )}
                                    {((!report.moderator &&
                                        report.reporting_user &&
                                        user.id === report.reporting_user.id) ||
                                        null) && (
                                        <button className="reject xs" onClick={report.cancel}>
                                            {_("Cancel")}
                                        </button>
                                    )}

                                    {((report.moderator &&
                                        user.is_moderator &&
                                        user.id === report.moderator.id) ||
                                        null) && (
                                        <button className="success xs" onClick={report.good_report}>
                                            {_("Good report")}
                                        </button>
                                    )}
                                    {((report.moderator &&
                                        user.is_moderator &&
                                        user.id === report.moderator.id) ||
                                        null) && (
                                        <button className="info xs" onClick={report.set_note}>
                                            {_("Note")}
                                        </button>
                                    )}
                                    {((report.moderator &&
                                        user.is_moderator &&
                                        user.id === report.moderator.id) ||
                                        null) && (
                                        <button className="danger xs" onClick={report.unclaim}>
                                            {_("Unclaim")}
                                        </button>
                                    )}
                                    {((report.moderator &&
                                        user.is_moderator &&
                                        user.id === report.moderator.id) ||
                                        null) && (
                                        <button className="reject xs" onClick={report.bad_report}>
                                            {_("Bad report")}
                                        </button>
                                    )}
                                </div>
                                <div className="spread">
                                    {report.reporting_user ? (
                                        <Player user={report.reporting_user} icon />
                                    ) : (
                                        <span>{_("System")}</span>
                                    )}
                                    <i>{moment(report.created).fromNow()}</i>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
