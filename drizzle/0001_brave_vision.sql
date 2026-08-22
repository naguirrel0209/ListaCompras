CREATE TABLE `activities` (
	`id` varchar(32) NOT NULL,
	`familyId` varchar(32) NOT NULL,
	`shoppingListId` varchar(32),
	`shoppingItemId` varchar(32),
	`action` varchar(48) NOT NULL,
	`actorName` varchar(80) NOT NULL,
	`description` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `familyGroups` (
	`id` varchar(32) NOT NULL,
	`name` varchar(80) NOT NULL,
	`inviteCode` varchar(16) NOT NULL,
	`passwordHash` text,
	`createdBy` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `familyGroups_id` PRIMARY KEY(`id`),
	CONSTRAINT `familyGroups_inviteCode_unique` UNIQUE(`inviteCode`)
);
--> statement-breakpoint
CREATE TABLE `shoppingItems` (
	`id` varchar(32) NOT NULL,
	`shoppingListId` varchar(32) NOT NULL,
	`name` varchar(120) NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`category` varchar(60) NOT NULL,
	`tagsJson` text NOT NULL,
	`itemStatus` enum('pending','completed','archived') NOT NULL DEFAULT 'pending',
	`createdBy` varchar(80) NOT NULL,
	`completedBy` varchar(80),
	`completedAt` timestamp,
	`archivedBy` varchar(80),
	`archivedAt` timestamp,
	`archiveReason` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shoppingItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shoppingLists` (
	`id` varchar(32) NOT NULL,
	`familyId` varchar(32) NOT NULL,
	`name` varchar(80) NOT NULL,
	`createdBy` varchar(80) NOT NULL,
	`isArchived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shoppingLists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `activities_family_idx` ON `activities` (`familyId`);--> statement-breakpoint
CREATE INDEX `shoppingItems_list_idx` ON `shoppingItems` (`shoppingListId`);--> statement-breakpoint
CREATE INDEX `shoppingItems_status_idx` ON `shoppingItems` (`itemStatus`);--> statement-breakpoint
CREATE INDEX `shoppingLists_family_idx` ON `shoppingLists` (`familyId`);