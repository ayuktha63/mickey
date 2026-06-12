import os
import mimetypes
from pathlib import Path
from typing import List, Dict, Any
import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

# Assuming we have a database session and models defined for RecentFile and FavoriteFolder
from app.database.models import RecentFile, FavoriteFolder

class FilesService:
    def __init__(self, db: Session, whitelist: List[Path]):
        self.db = db
        self.whitelist = [p.resolve() for p in whitelist]

    def _is_path_allowed(self, path: Path) -> bool:
        try:
            resolved = path.resolve()
            return any(resolved.is_relative_to(allowed) for allowed in self.whitelist)
        except Exception:
            return False

    def get_metadata(self, file_path: str) -> Dict[str, Any]:
        p = Path(file_path)
        if not p.is_file() or not self._is_path_allowed(p):
            raise HTTPException(status_code=404, detail="File not found or access denied")
        stat = p.stat()
        return {
            "path": str(p),
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "type": mimetypes.guess_type(p.name)[0] or "application/octet-stream",
        }

    def read_file(self, file_path: str) -> str:
        p = Path(file_path)
        if not p.is_file() or not self._is_path_allowed(p):
            raise HTTPException(status_code=404, detail="File not found or access denied")
        return p.read_text(errors="ignore")

    def search_by_name(self, query: str) -> List[Dict[str, Any]]:
        results = []
        for allowed in self.whitelist:
            for p in allowed.rglob(f'*{query}*'):
                if p.is_file():
                    results.append(self.get_metadata(str(p)))
        return results

    def search_by_extension(self, ext: str) -> List[Dict[str, Any]]:
        if not ext.startswith('.'):
            ext = f'.{ext}'
        results = []
        for allowed in self.whitelist:
            for p in allowed.rglob(f'*{ext}'):
                if p.is_file():
                    results.append(self.get_metadata(str(p)))
        return results

    # Placeholder for content search – a real implementation would use an indexed search engine.
    def search_by_content(self, query: str, file_type: str = None) -> List[Dict[str, Any]]:
        # For simplicity, perform a naive scan of text files only.
        results = []
        for allowed in self.whitelist:
            for p in allowed.rglob('*'):
                if not p.is_file():
                    continue
                if file_type and not p.suffix.lower() == f'.{file_type.lower()}':
                    continue
                try:
                    content = p.read_text(errors='ignore')
                except Exception:
                    continue
                if query.lower() in content.lower():
                    results.append(self.get_metadata(str(p)))
        return results

    # Recent and favorite helpers
    def add_recent(self, file_path: str):
        try:
            meta = self.get_metadata(file_path)
        except HTTPException:
            return
        try:
            recent = self.db.query(RecentFile).filter(RecentFile.path == meta["path"]).first()
            if recent:
                recent.last_opened = datetime.datetime.utcnow()
            else:
                recent = RecentFile(path=meta["path"], size=meta["size"], last_opened=datetime.datetime.utcnow())
                self.db.add(recent)
            self.db.commit()
        except Exception:
            try:
                self.db.rollback()
            except Exception:
                pass

    def list_recent(self, sort_by: str = "date") -> List[RecentFile]:
        q = self.db.query(RecentFile)
        if sort_by == "size":
            q = q.order_by(RecentFile.size.desc())
        elif sort_by == "name":
            q = q.order_by(RecentFile.path)
        else:  # date
            q = q.order_by(RecentFile.last_opened.desc())
        return q.all()

    def list_favorites(self) -> List[FavoriteFolder]:
        return self.db.query(FavoriteFolder).all()
