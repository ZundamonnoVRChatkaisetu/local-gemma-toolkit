import Link from 'next/link';

export default function Home() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Local Gemma Toolkit</h1>
        <p className="text-xl mb-8 max-w-2xl mx-auto">
          プライバシー重視のAIアプリケーション - Gemma 27B（6B量子化）搭載
        </p>
        <p className="text-gray-600 max-w-2xl mx-auto">
          すべての処理はローカルデバイス上で実行され、データが外部に送信されることはありません
        </p>
      </section>
      
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <Link 
          href="/chat"
          className="block p-8 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-4">💬</div>
          <h2 className="text-2xl font-semibold mb-2">チャット</h2>
          <p className="text-gray-600 mb-4">ローカルマシン上で完全に動作するGemmaと自然な会話ができます。</p>
          <span className="text-blue-500 hover:underline">チャットを始める →</span>
        </Link>
        
        <Link 
          href="/search"
          className="block p-8 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-4">🔍</div>
          <h2 className="text-2xl font-semibold mb-2">詳細検索</h2>
          <p className="text-gray-600 mb-4">AI駆動の意味理解によるドキュメント検索ができます。</p>
          <span className="text-blue-500 hover:underline">検索を始める →</span>
        </Link>
        
        <Link 
          href="/learn"
          className="block p-8 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-4">📚</div>
          <h2 className="text-2xl font-semibold mb-2">学習プラットフォーム</h2>
          <p className="text-gray-600 mb-4">自動問題生成と進捗追跡による個別最適化された学習環境を提供します。</p>
          <span className="text-blue-500 hover:underline">学習を始める →</span>
        </Link>
        
        <Link 
          href="/security"
          className="block p-8 border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-4">🔒</div>
          <h2 className="text-2xl font-semibold mb-2">セキュリティ</h2>
          <p className="text-gray-600 mb-4">AIによるセキュリティ監視と分析でシステムの安全を確保します。</p>
          <span className="text-blue-500 hover:underline">セキュリティを確認 →</span>
        </Link>
      </section>
      
      <section className="max-w-4xl mx-auto mt-16 p-8 bg-gray-50 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">プロジェクトについて</h2>
        <p className="mb-4">
          Local Gemma Toolkitは、完全にローカルマシン上で動作する強力な言語モデルGemma 27B（6B量子化）を基盤としています。
          これにより、データがデバイスから外部に送信されることなく、プライバシーとセキュリティが確保されます。
        </p>
        <p>
          すべての機能はオフラインで動作するよう設計されており、プライバシーを犠牲にすることなく高度なAI機能を利用できます。
        </p>
      </section>
    </div>
  );
}
