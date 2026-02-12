import { useState } from 'react'
import gio100Image from '../assets/gio_100_dump.jpeg'
import './News.css'

// Stats for the Gio 100 article — fixed as of February 12, 2026 (do not update)
const GIO_100_ARTICLE_STATS_AS_OF_FEB_12 = {
  dumpCount2026: 100,
  avgPerDay: 2.73,
  rank2026: null,
  distinctLocations: null,
  singleDayRecord: null,
}

function News({ user, onBack }) {
  const [selectedArticleId, setSelectedArticleId] = useState(null)
  const gioStats = GIO_100_ARTICLE_STATS_AS_OF_FEB_12

  const articles = [
    {
      id: 'gio-100-dumps',
      title: '🎉 Giovanni Caracciolo Hits 100 Dumps',
      author: 'Dump Tracker News',
      date: 'February 12, 2026',
      content: (
        <article className="news-article-body">
          <p>
            <strong>Giovanni Caracciolo</strong> reached a major milestone on Thursday, February 12th, 2026: his 100th dump of the year. The achievement caps an impressive run of consistency since joining Dump Tracker 2026.
          </p>
          <figure className="news-article-figure">
            <img src={gio100Image} alt="Giovanni Caracciolo holding a sign showing 100" />
            <figcaption>Giovanni Caracciolo celebrates 100 dumps on February 12, 2026.</figcaption>
          </figure>
          <p>
            To get to 100, Gio averaged <strong>{typeof gioStats.avgPerDay === 'number' ? gioStats.avgPerDay.toFixed(2) : gioStats.avgPerDay} dumps per day</strong>, putting him among the most consistent contributors on the platform. With 100 dumps logged in 2026 so far, he has established himself as a force to be reckoned with on the yearly leaderboard.
            {gioStats.rank2026 != null && (
              <> As of this writing, he holds <strong>#{gioStats.rank2026}</strong> on the 2026 leaderboard.</>
            )}
          </p>
          {gioStats.distinctLocations != null && gioStats.distinctLocations > 0 && (
            <p>
              Caracciolo has logged dumps at <strong>{gioStats.distinctLocations}</strong> distinct location{gioStats.distinctLocations !== 1 ? 's' : ''}, proving that dedication knows no address.
            </p>
          )}
          {gioStats.singleDayRecord != null && Number(gioStats.singleDayRecord) > 0 && (
            <p>
              His single-day record stands at <strong>{gioStats.singleDayRecord}</strong> dump{Number(gioStats.singleDayRecord) !== 1 ? 's' : ''}, showing he can turn it on when it matters.
            </p>
          )}
          <p>
            Congratulations to Giovanni on 100 dumps. Here's to the next hundred. 🚽
          </p>
        </article>
      ),
    },
  ]

  const selectedArticle = selectedArticleId ? articles.find((a) => a.id === selectedArticleId) : null

  return (
    <div className="news-container">
      <div className="news-header">
        <button
          onClick={() => (selectedArticle ? setSelectedArticleId(null) : onBack())}
          className="back-button"
        >
          ← {selectedArticle ? 'Back to list' : 'Back'}
        </button>
        <h1>📰 News</h1>
        <div style={{ width: '60px' }}></div>
      </div>

      <div className="news-content">
        {selectedArticle ? (
          <div className="news-article-detail">
            <h2 className="news-article-title">{selectedArticle.title}</h2>
            <div className="news-article-meta">
              <span className="news-article-author">{selectedArticle.author}</span>
              <span className="news-article-date">{selectedArticle.date}</span>
            </div>
            <div className="news-article-content">{selectedArticle.content}</div>
          </div>
        ) : (
          <ul className="news-articles-list">
            {articles.map((art) => (
              <li key={art.id}>
                <button
                  type="button"
                  className="news-article-list-item"
                  onClick={() => setSelectedArticleId(art.id)}
                >
                  <span className="news-list-item-title">{art.title}</span>
                  <span className="news-list-item-meta">
                    {art.author} · {art.date}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default News
