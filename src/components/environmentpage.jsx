import React from 'react';
import { UIButton } from './common/nextbutton.jsx';
import { RadioSet } from './common/radioset.jsx';
import { Selector } from './common/selector.jsx';
import { Notification } from './common/notifications.jsx';
import { listDir, getISOContents, getCephVersionNumber, isEmpty } from '../services/utils.js';
import '../app.scss';
import { PasswordBox } from './common/password.jsx';
import { Tooltip } from './common/tooltip.jsx';

export class EnvironmentPage extends React.Component {
    //
    // this page offers the high level cluster configuration options like
    // version/release and filestore/bluestore. Defaults are defined in
    // the components initial state

    constructor(props) {
        super(props);
        this.state = {
            className: this.props.className,
            osdType: props.defaults.osdType,
            networkType: props.defaults.networkType,
            sourceType: props.defaults.sourceType,
            clusterType: props.defaults.clusterType,
            osdMode: props.defaults.osdMode,
            installType: props.defaults.installType,
            flashUsage: props.defaults.flashUsage,
            targetVersion: props.defaults.targetVersion,
            cephVersion: "",
            msgLevel: "info",
            msgText: "",
            rhnUserName: "",
            rhnPassword: "",
            credentialsClass: "visible"
        };

        this.installSource = {
            "Red Hat": ["RHCS 4"],
            "ISO": [],
            "Community": ["14 (Nautilus)", "13 (Mimic)", "12 (Luminous)"],
            "Distribution": ["13 (Mimic)", "12 (Luminous)"]
        };
        this.installSourceToolTip = "For an ISO install, the image must be in /usr/share/ansible-runner-service/iso\n and have container_file_t SELINUX context";

        this.clusterTypes = {
            options : ["Production", "Development/POC"],
            tooltip : "Production mode applies strict configuration rules. To relax rules for\na developer or POC, use Development/POC mode"
        };

        this.osd_type = {
            description: "OSD type",
            options: ["Bluestore", "Filestore"],
            name: "osdType",
            tooltip: "Bluestore is the default OSD type, offering more features and improved\nperformance. Filestore is supported as a legacy option only",
            horizontal: true
        };
        this.network_type = {
            description: "Network connectivity",
            options: ['ipv4'], // 'ipv6'],
            name: 'networkType',
            tooltip: "",
            horizontal: true
        };
        this.source = {
            description: "Software source",
            options: ["Red Hat", "OS Distribution", "Community"],
            name: "sourceType",
            tooltip: '',
            horizontal: true
        };
        this.osd_mode = {
            description: "Encryption",
            options: ["None", "Encrypted"],
            name: "osdMode",
            info: "For added security, you may use at-rest encryption for your storage devices",
            tooltip: "Data encryption uses the Linux dmcrypt subsystem (LUKS1)",
            horizontal: true
        };

        this.install_type = {
            description: "Installation type",
            options: ["Container", "RPM"],
            name: "installType",
            info: "Ceph can be installed as lightweight container images, or as rpm packages. Container deployments offer service isolation enabling improved collocation and hardware utilization",
            tooltip: "Ceph containers are managed by systemd, and use CPU and RAM limits to optimize collocation",
            horizontal: true
        };
        this.flash_usage = {
            description: "Flash Configuration",
            options: ["Journals/Logs", "OSD Data"],
            name: "flashUsage",
            info: "Flash media (SSD or NVMe) can be used for all data, or as journal devices to improve the performance of slower devices (HDDs)",
            tooltip: "In Journal 'mode', the installation process will check HDD:Flash media\nratios against best practice",
            horizontal: true
        };
    }

    clusterTypeChange = (event) => {
        console.log("changing the type of cluster to " + event.target.value);
        this.setState({clusterType: event.target.value});
    }

    installChange = (event) => {
        console.log("changing installation settings for: " + event.target.value);
        // if the install source is ISO, the target version must not be No ISO...
        let credentialsVisibility;
        let credentialsRequired = ["Red Hat", "ISO"];
        if (event.target.value == "ISO") {
            if (this.installSource["ISO"][0].startsWith('No')) {
                this.setState({
                    msgLevel: 'error',
                    msgText: "No ISO images have been found. Confirm ISO image location and check SELINUX context OR select another source",
                    sourceType: "ISO"
                });
                return;
            } else {
                // acceptable ISO installation
                console.debug("updating install type to RPM for ISO support");
                this.setState({
                    installType: "RPM"
                });
            }
        }

        // if the target.value is Red Hat or ISO reveal the credentials component,
        // otherwise hide it
        if (credentialsRequired.includes(event.target.value)) {
            credentialsVisibility = 'visible';
        } else {
            credentialsVisibility = 'hidden';
        }

        this.setState({
            credentialsClass: credentialsVisibility,
            msgLevel: 'info',
            msgText: '',
            sourceType: event.target.value,
            targetVersion: this.installSource[event.target.value][0]
        });
    }

    versionChange = (event) => {
        this.setState({targetVersion: event.target.value});
        console.log("changing version : " + event.target.value);
    }

    updateState = (event) => {
        console.log("received a state change for radio button: " + event.target.getAttribute('name') + " with " + event.target.value);
        this.setState({ [event.target.getAttribute('name')]: event.target.value });
    }

    credentialsChange = (event) => {
        let credType = event.target.getAttribute("name");

        switch (credType) {
        case "username":
            this.setState({
                rhnUserName: event.target.value
            });
            break;
        case "password":
            this.setState({
                rhnPassword: event.target.value
            });
            break;
        }

        if (this.state.msgText.startsWith("RHN username")) {
            this.setState({
                msgLevel: "info",
                msgText: ""
            });
        }
    }

    checkReady = (event) => {
        console.log("current radio button config: " + JSON.stringify(this.state));
        // insert any validation logic here - that would compare the state settings prior to passing page state to the parent
        let requiresCredentials = ["Red Hat", "ISO"];
        if (this.state.msgLevel != "info") {
            return;
        }

        if (requiresCredentials.includes(this.state.sourceType)) {
            // ensure the credentials are not null
            if (isEmpty(this.state.rhnUserName) || isEmpty(this.state.rhnPassword)) {
                this.setState({
                    msgLevel: 'error',
                    msgText: "RHN username/password must be provided for Red Hat or ISO based deployments"
                });
                return;
            }
        }

        if (this.state.sourceType == 'ISO') {
            // if (this.state.installSource != 'RPM') {
            //     this.setState({
            //         msgLevel: 'error',
            //         msgText: "Installation from ISO, only supports RPM based deployment"
            //     });
            //     return;
            // }

            // check the iso is OK
            let pathName = '/usr/share/ansible-runner-service/iso';
            console.log("Performing ISO checks");
            getISOContents(pathName + '/' + this.state.targetVersion)
                    .then((content) => {
                        let stdout = content.split('\n');
                        console.debug("ISO scan returned " + stdout.length + " lines");

                        let versionStr = '';
                        for (let line of stdout) {
                            if (line.includes("ceph-common")) {
                                // example :  20178948 /Tools/ceph-common-14.2.2-16.ga7a380a.1.el8cp.x86_64.rpm
                                let fileName = line.split('/').pop();
                                versionStr = fileName.replace('ceph-common-', '').split('.')[0];
                                break;
                            }
                        }

                        if (!versionStr) {
                            console.log("ISO does not contain a ceph-common package..unable to confirm its a Ceph ISO");
                            this.setState({
                                msgLevel: 'error',
                                msgText: "ISO does not contain a ceph-common package. Is it Ceph ISO?"
                            });
                            return;
                        }

                        console.log("ceph-common file found on the ISO. Ceph version : " + versionStr);
                        let currentState = this.updateVersion(versionStr);
                        this.props.action(currentState);
                    })
                    .catch(() => {
                        console.error("Unable to read the iso");
                        this.setState({
                            msgLevel: "error",
                            msgText: "Unable to read the ISO file"
                        });
                    });
        } else {
            let currentState = this.updateVersion(getCephVersionNumber(this.state.targetVersion));
            console.debug("leaving environmentpage, invoking callback with " + JSON.stringify(currentState));
            this.props.action(currentState);
        }
    }

    updateVersion = (versionStr) => {
        let currentState = Object.assign({}, this.state);
        currentState['cephVersion'] = versionStr;
        console.debug("setting environmentPage state's cephversion to " + versionStr);
        this.setState({
            cephVersion: versionStr
        });
        return currentState;
    }

    componentDidMount () {
        listDir('/usr/share/ansible-runner-service/iso')
                .then((content) => {
                    console.log("list of ansible-runner-service directory complete");
                    let iso = [];
                    let filesFound = content.split(" ");
                    filesFound.forEach(filePath => {
                        filePath = filePath.trim();
                        if (filePath.toUpperCase().endsWith('.ISO')) {
                            iso.push(filePath.split('/').pop());
                        }
                    });
                    if (iso.length == 0) {
                        iso.push("No ISO images found");
                    }
                    this.installSource['ISO'] = iso;
                    console.log(iso.length + " iso images :" + iso);
                })
                .catch(() => {
                    console.error("Unable to list ansible-runner-service directory");
                });
    }

    render() {
        var versionList = this.installSource[this.state.sourceType];
        if (this.props.className == 'page') {
            return (
                <div id="environment" className={this.props.className}>
                    <h3>1. Environment</h3>
                    Define the high level environment settings that will determine the way that the Ceph cluster is installed and configured.
                    <Notification msgLevel={this.state.msgLevel} msgText={this.state.msgText} />
                    <div >
                        <Selector
                            labelName="Installation Source"
                            vertical
                            value={this.state.sourceType}
                            options={Object.keys(this.installSource)}
                            tooltip={this.installSourceToolTip}
                            callback={this.installChange} />
                        <Selector
                            labelName="Target Version"
                            vertical
                            value={this.state.targetVersion}
                            options={versionList}
                            callback={this.versionChange} />
                        <Selector
                            labelName="Cluster Type"
                            vertical
                            value={this.state.clusterType}
                            options={this.clusterTypes.options}
                            tooltip={this.clusterTypes.tooltip}
                            callback={this.clusterTypeChange} />
                    </div>
                    <Credentials visible={this.state.credentialsClass}
                                 callback={this.credentialsChange}
                                 user={this.state.rhnUserName}
                                 password={this.state.rhnPassword} />
                    <RadioSet config={this.network_type} default={this.state.networkType} callback={this.updateState} />
                    <RadioSet config={this.osd_type} default={this.state.osdType} callback={this.updateState} />
                    <RadioSet config={this.flash_usage} default={this.state.flashUsage} callback={this.updateState} />
                    <RadioSet config={this.osd_mode} default={this.state.osdMode} callback={this.updateState} />
                    <RadioSet config={this.install_type} default={this.state.installType} callback={this.updateState} />
                    <div className="nav-button-container">
                        <UIButton primary btnLabel="Hosts &rsaquo;" action={this.checkReady} />
                    </div>
                </div>
            );
        } else {
            console.log("Skipping render of environmentpage - not active");
            return (<div id="environment" className={this.props.className} />);
        }
    }
}

class Credentials extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
        };
    }

    render() {
        return (
            <div className={this.props.visible}>
                <span className="input-label-horizontal display-inline-block">
                    <b>RHN User Name</b>
                    <Tooltip text={"RHN credentials are needed to authenticate against\nthe Red Hat container registry"} />
                </span>
                <input type="text"
                       name="username"
                       defaultValue={this.props.user}
                       className="form-control input-lg input-text display-inline-block"
                       maxLength="20"
                       placeholder="Username"
                       onBlur={this.props.callback} />
                <PasswordBox passwordPrompt="RHN Password" name="password" value={this.props.password} callback={this.props.callback} />
            </div>
        );
    }
}

export default EnvironmentPage;
