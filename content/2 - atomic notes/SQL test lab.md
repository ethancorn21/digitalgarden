2026-05-23 15:26
status: #baby
tags: [[technology]]; [[homelab]]

---
# SQL test lab

created a VM on VLAN 45, my untrusted VLAN. This is because its just a test database. No data in here will be used in prod, so it resides with my other untrusted servers. I am using Debian LTS for the OS. I then installed docker using the official documentation.

Then i ssh'd from visual studio to the VM, this allows me to see the files in a real file structure way, as well as quickly make edits/create new files. This is my preferred way to interact with docker containers. 



make sure to add your username to the docker account so that you dont have to use "sudo" with docker commands
``` sh
sudo usermod -aG docker $USER
```

## *AI GENERATED DB*
```sql
/* 1. Create the Database */
CREATE DATABASE UniversityHelpDesk;
GO

USE UniversityHelpDesk;
GO

/* 2. Create the Tables */
-- The users who submit tickets
CREATE TABLE Users (
    UserID INT PRIMARY KEY IDENTITY(1,1),
    FullName VARCHAR(100),
    Department VARCHAR(50)
);

-- The status options (Open, Closed, etc.)
CREATE TABLE Statuses (
    StatusID INT PRIMARY KEY,
    StatusName VARCHAR(20)
);

-- The actual tickets
CREATE TABLE Tickets (
    TicketID INT PRIMARY KEY IDENTITY(100,1), -- Auto-numbers starting at 100
    UserID INT,
    StatusID INT,
    Subject VARCHAR(200),
    Details TEXT,
    CreatedDate DATETIME DEFAULT GETDATE(),
    -- These link the tables together (Foreign Keys)
    FOREIGN KEY (UserID) REFERENCES Users(UserID),
    FOREIGN KEY (StatusID) REFERENCES Statuses(StatusID)
);

/* 3. Inject Dummy Data */
INSERT INTO Statuses VALUES (1, 'Open'), (2, 'Pending'), (3, 'Closed');

INSERT INTO Users (FullName, Department) VALUES 
('Ethan', 'IT Networking'),
('Dr. Smith', 'Philosophy'),
('Prof. Jones', 'Economics');

INSERT INTO Tickets (UserID, StatusID, Subject, Details) VALUES 
(1, 1, 'Server Rack Power Issue', 'The breaker keeps tripping in the server room.'),
(2, 1, 'Projector Broken', 'The projector in Hall B displays blue tint.'),
(3, 3, 'Email Access', 'Cannot login to Outlook via Citrix.'),
(1, 2, 'Firewall Rules', 'Need to open port 1433 for testing.');
```


```sql
create view v_TicketDetails as
select
	Tickets.TicketID,
	Tickets.Subject,
	Users.FullName as [requester],
	Statuses.StatusName as [CurrentStatus],
	Tickets.Details,
	Tickets.CreatedDate
from Tickets
join Users on Tickets.UserID = Users.UserID
join Statuses on Tickets.StatusID = Statuses.StatusID;
```

```sql
select * from v_TicketDetails;

select * from v_TicketDetails

select * from v_AllTicketDetails where Requester = 'Ethan';
```


Implement Parato Analysis? Sort by most common problems.
See how you can implement data analysis.

---
## see also:

