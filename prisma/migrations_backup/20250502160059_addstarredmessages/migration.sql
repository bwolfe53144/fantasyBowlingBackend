-- CreateTable
CREATE TABLE "_StarredMessages" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StarredMessages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_StarredMessages_B_index" ON "_StarredMessages"("B");

-- AddForeignKey
ALTER TABLE "_StarredMessages" ADD CONSTRAINT "_StarredMessages_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StarredMessages" ADD CONSTRAINT "_StarredMessages_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
