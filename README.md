# cockpit-ceph-installer
This project aims to provide a simple means to deploy a Ceph cluster by 'teaming up' with the [ansible-runner](https://github.com/ansible/ansible-runner) and [ansible-runner-service](https://github.com/ansible/ansible-runner-service) projects. It uses the cockpit UI to validate the intended hosts are suitable for Ceph, and drive the complete ansible installation using [ceph-ansible.](https://github.com/ceph/ceph-ansible)

## Project Status
The plugin currently
- supports different Ceph versions, bluestore and filestore, encrypted/non-encrypted
- for a Nautilus target, a separate metrics hosts is *required*. This host provides full prometheus/grafana integration for the Ceph UI (dashboard)
- probes and validates candidate hosts against their intended Ceph role(s)
- presents available networks for the public, cluster, S3 and iSCSI networks
- provides a review of the selections made
- configuration options selected are committed to standard yml format ansible files (host & group vars)
- initiates the ceph-ansible playbook and monitors progress
- any deployment errors are shown in the UI
- following a Nautilus based deployment, the user may click a link to go straight to Ceph's web management console
- allows environment defaults to be overridden from `/var/lib/cockpit/ceph-installer/defaults.json`
- supported roles: mons (inc mgrs), mds, osds, rgws and iscsi gateways, metrics
- support All-in-One installs for POC (aka kick-the-tyres)
- creates log of all the settings detected and requested at `~/cockpit-ceph-installer.log`

### Known Issues
1. An ISO based deployment may not install the ceph-grafana-dashboards rpm
2. On slow links the podman/docker pull could hit the default timeout of 300s, resulting in a failed deployment. If this occurs, consider downloading the required containers manually and click 'Retry'  

## Curious, take a look...

[![demo](screenshots/ceph-installer-2019-04.gif)](https://youtu.be/wIw7RjHPhzs)

## Take it for a testdrive
In this example we'll assume that you have a test VM ready to act as an ansible controller, and a set of VMs that you want to install Ceph to. Remember to ensure that the machines can each resolve here names (/etc/hosts will be fine!) All the commands need system privileges, so you'll need root or a sudo enabled account (I'm assuming root in these example steps).
### 1. Configure the pre-requisites
#### **Fedora 28/29/30**
1.1 As root run the following commands to install pre-requisite packages
```
# dnf install docker cockpit-ws cockpit-bridge git 
```

#### **RHEL7**
  * Install pre-requisite packages
```
# yum install -y docker cockpit-ws cockpit-bridge git 
```

### **CentOS 7**
* As root run the following commands to install pre-requisite packages
```
# yum install -y docker cockpit git 
```

1.2 Enable and start docker daemon (unless your using podman!)
```
# systemctl enable docker.service
# systemctl start docker.service
```
1.3 If your installation target(s) use names, ensure name resolution is working either through DNS or /etc/hosts

### 2. Install ceph-ansible from the Ceph project
2.1 Install python-notario (required by ceph-ansible)  
2.2 Pull ceph-ansible from github (you'll need the latest stable-4.0 branch, or master)  
```
# cd /usr/share
# git clone https://github.com/ceph/ceph-ansible.git
```
2.3 Make the installation playbooks available to the runner-service  
```
# cd ceph-ansible
# cp site.yml.sample site.yml
# cp site-container.yml.sample site-container.yml
```  

### 3. Install the cockpit plugin
3.1 Get the cockpit plugin src  
```
# cd ~
# sudo git clone https://github.com/pcuzner/cockpit-ceph-installer.git
# cd cockpit-ceph-installer
```

3.2. Add a symlink to the dist folder of your cockpit-ceph-installer directory
```
# ln -snf dist /usr/share/cockpit/cockpit-ceph-installer
# systemctl restart cockpit.socket
```
3.3 From the root of the cockpit-ceph-installer directory, copy the checkrole components over to ceph-ansible's working directory
```
# cp utils/ansible/checkrole.yml /usr/share/ceph-ansible
# cp utils/ansible/library/ceph_check_role.py /usr/share/ceph-ansible/library/.
```
  
### 4. Start the ansible API (ansible-runner-service)
Although the ansible-runner-service runs as a container, it's configuration and playbooks come from the host filesystem.

4.1 As the **root** user, switch to the projects ``utils`` folder. 
```
# cd utils
# ./ansible-runner-service.sh -s -v
```
NB. This script wil create and configure missing directories, set up default (self-signed) SSL identities, and download the runner-service container.  

4.2 Once the runner-service is running you'll be presented with a URL to use to connect to GUI installer. Login as the root user.
  

-----------------------------------------------------------------------------------------------------------------

## Hack on it

To hack on the UI plugin, you'll need a nodejs install for ReactJS and a cockpit environment. Take a look at the
[dev guide](DEVGUIDE.md) for instructions covering how to set things up.

For background, take a look at the great starter kit [docs](https://github.com/cockpit-project/starter-kit) that the cockpit devs have produced.
